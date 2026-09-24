import {
  defaultPayouts, formatPrice, isAccountNumber, isIfsc, isPan, isUpiId, payableUpTo, todayISO,
  type BankAccount, type Me, type PayoutAccountView, type PayoutLine, type PayoutSettings, type PayoutSummary,
} from '@meridian/shared'
import { auditLogRepo, bookingsRepo, contentRepo, payoutsRepo, usersRepo, type BookingDoc } from '../repositories'
import { decryptSecret, encryptSecret, encryptionReady } from '../store/secrets'
import { C, col, nowISO } from '../store/db'
import { AppError, notFound } from '../http/errors'
import { collect, str } from '../http/validate'
import { notifyService } from './notify'
import { siteOrigin } from '../http/origin'

// Paying hosts. A booking's earnings become payable once the guest has checked out and the hold
// period has passed — that window is what covers late cancellations and complaints. Nothing is sent
// automatically: your team decides when to pay, records the bank's reference, and the host sees it.

const accountDoc = (hostId: number) => col(C.secrets).doc(`payout-${hostId}`)

interface StoredAccount {
  holder: string
  accountEnc?: string
  last4: string
  ifsc: string
  bankName: string
  upiId: string
  pan: string
  updatedAt: string
}

async function settings(): Promise<PayoutSettings> {
  return (await contentRepo.settings()).payouts ?? defaultPayouts
}

/** Earnings from one booking, as a line on a payout. */
const lineOf = (b: BookingDoc): PayoutLine => ({
  bookingCode: b.code,
  property: b.property.title,
  checkIn: b.checkIn,
  checkOut: b.checkOut,
  gross: (b.totalMinor - b.refundedMinor) / 100,
  commissionPct: b.commissionPct,
  commission: b.commissionMinor / 100,
  net: b.hostPayoutMinor / 100,
})

/** Bookings that have earned a host money: confirmed, paid for, and not cancelled away to nothing. */
const earned = (b: BookingDoc) =>
  !!b.confirmedAt && b.hostPayoutMinor > 0 && (b.status === 'Confirmed' || b.status === 'Cancelled')

export const payoutService = {
  async view(hostId: number): Promise<PayoutAccountView> {
    const snap = await accountDoc(hostId).get()
    const a = snap.exists ? (snap.data() as StoredAccount) : null
    const hasBank = !!(a?.accountEnc && a.ifsc && a.holder)
    return {
      holder: a?.holder ?? '',
      maskedAccount: a?.last4 ? `••••${a.last4}` : '',
      ifsc: a?.ifsc ?? '',
      bankName: a?.bankName ?? '',
      upiId: a?.upiId ?? '',
      pan: a?.pan ?? '',
      complete: hasBank || !!a?.upiId,
      updatedAt: a?.updatedAt ?? null,
    }
  },

  /** A blank account number keeps the saved one, the same as the payment and mail screens. */
  async saveAccount(host: Me, input: Partial<BankAccount>) {
    if (!encryptionReady) throw new AppError(503, 'SETTINGS_ENCRYPTION_KEY is missing, so bank details can’t be stored safely.')
    const existing = await accountDoc(host.id).get()
    const saved = existing.exists ? (existing.data() as StoredAccount) : null

    const holder = str(input.holder).slice(0, 80)
    const accountNumber = str(input.accountNumber)
    const ifsc = str(input.ifsc).toUpperCase()
    const upiId = str(input.upiId)
    const pan = str(input.pan).toUpperCase()
    const wantsBank = !!(accountNumber || ifsc || saved?.accountEnc)

    collect({
      holder: !holder && (wantsBank || upiId) ? 'Whose account is this?' : null,
      accountNumber: !accountNumber && !saved?.accountEnc && !upiId ? 'Add a bank account or a UPI id.'
        : accountNumber && !isAccountNumber(accountNumber) ? 'An account number is 9 to 18 digits.' : null,
      ifsc: wantsBank && !isIfsc(ifsc) ? 'An IFSC looks like HDFC0001234.' : null,
      upiId: upiId && !isUpiId(upiId) ? 'A UPI id looks like name@bank.' : null,
      pan: pan && !isPan(pan) ? 'A PAN looks like ABCDE1234F.' : null,
    })

    const patch: StoredAccount = {
      holder,
      last4: accountNumber ? accountNumber.slice(-4) : saved?.last4 ?? '',
      ifsc,
      bankName: str(input.bankName).slice(0, 80),
      upiId,
      pan,
      updatedAt: nowISO(),
    }
    if (accountNumber) patch.accountEnc = encryptSecret(accountNumber)
    await accountDoc(host.id).set(patch, { merge: true })
    return this.view(host.id)
  },

  /** What a host is owed, what is still inside its hold period, and what has already been sent. */
  async summary(hostId: number): Promise<PayoutSummary> {
    const [config, bookings, payouts] = await Promise.all([
      settings(),
      bookingsRepo.forHostRaw(hostId),
      payoutsRepo.list({ hostId }),
    ])
    const cutoff = payableUpTo(todayISO(), config.holdDays)
    const alreadyIn = new Set(payouts.flatMap((p) => (p.status === 'Failed' ? [] : p.bookingCodes)))

    const open = bookings.filter((b) => earned(b) && !alreadyIn.has(b.code))
    const dueLines = open.filter((b) => b.checkOut <= cutoff).map(lineOf)
    const pending = open.filter((b) => b.checkOut > cutoff).reduce((sum, b) => sum + b.hostPayoutMinor, 0) / 100

    return {
      due: dueLines.reduce((sum, l) => sum + l.net, 0),
      dueLines,
      pending,
      processing: payouts.filter((p) => p.status === 'Processing').reduce((sum, p) => sum + p.net, 0),
      paidToDate: payouts.filter((p) => p.status === 'Paid').reduce((sum, p) => sum + p.net, 0),
    }
  },

  history: (hostId: number) => payoutsRepo.list({ hostId }),

  // ── Control centre ─────────────────────────────────────────────────────────

  /** Every host with money waiting, most owed first. */
  async owing() {
    const config = await settings()
    const hosts = (await usersRepo.allHosts())
    const rows = await Promise.all(hosts.map(async (host) => {
      const [summary, account] = await Promise.all([this.summary(host.id), this.view(host.id)])
      return {
        hostId: host.id,
        hostName: host.name,
        contact: host.email ?? host.phone ?? '',
        due: summary.due,
        bookings: summary.dueLines.length,
        pending: summary.pending,
        accountReady: account.complete,
        account: account.maskedAccount || account.upiId,
      }
    }))
    return {
      minimumPayout: config.minimumPayout,
      holdDays: config.holdDays,
      hosts: rows.filter((r) => r.due > 0 || r.pending > 0).sort((a, b) => b.due - a.due),
    }
  },

  /** Turns everything a host is owed into one payout, ready to be sent. */
  async create(admin: Me, hostId: number) {
    const [config, host, summary, account] = await Promise.all([
      settings(), usersRepo.findById(hostId), this.summary(hostId), this.view(hostId),
    ])
    if (!host) throw notFound('host')
    if (!summary.dueLines.length) throw new AppError(400, 'This host has nothing waiting to be paid.')
    if (!account.complete) throw new AppError(400, `${host.name} hasn’t added bank or UPI details yet, so there is nowhere to send it.`)
    if (summary.due < config.minimumPayout) {
      throw new AppError(400, `That comes to ${formatPrice(summary.due)}, under the ${formatPrice(config.minimumPayout)} minimum. Wait for more bookings, or lower the minimum in Settings.`)
    }

    const dates = summary.dueLines.map((l) => l.checkOut).sort()
    const payout = await payoutsRepo.create({
      hostId,
      hostName: host.name,
      periodStart: dates[0],
      periodEnd: dates[dates.length - 1],
      lines: summary.dueLines,
      bookingCodes: summary.dueLines.map((l) => l.bookingCode),
      gross: summary.dueLines.reduce((s, l) => s + l.gross, 0),
      commission: summary.dueLines.reduce((s, l) => s + l.commission, 0),
      net: summary.due,
      status: 'Processing',
      method: account.maskedAccount ? 'bank' : 'upi',
      account: account.maskedAccount || account.upiId,
      reference: '',
      note: '',
      paidAt: null,
    })
    await auditLogRepo.record(admin, 'payout.create', 'payout', payout.id, { hostId, net: summary.due })
    return payout
  },

  /** Records that the money actually left, with the bank's reference so a host can trace it. */
  async markPaid(admin: Me, id: number, reference: string, note: string) {
    const payout = await payoutsRepo.find(id)
    if (!payout) throw notFound('payout')
    if (payout.status === 'Paid') throw new AppError(400, 'This payout is already marked as paid.')
    collect({ reference: reference.trim().length >= 4 ? null : 'Enter the bank’s reference number (UTR) so the host can trace it.' })

    await payoutsRepo.update(id, { status: 'Paid', reference: reference.trim(), note: note.slice(0, 300), paidAt: nowISO() })
    await auditLogRepo.record(admin, 'payout.paid', 'payout', id, { reference, net: payout.net })

    const host = await usersRepo.findById(payout.hostId)
    if (host) {
      await notifyService.send('payout.sent', { name: host.name, email: host.email, phone: host.phone }, {
        total: formatPrice(payout.net),
        dates: `${payout.periodStart} – ${payout.periodEnd}`,
        reference: reference.trim(),
        account: payout.account,
        link: `${siteOrigin()}/host/payouts`,
      })
    }
    return (await payoutsRepo.find(id))!
  },

  /** The transfer bounced: the earnings go back to Due so they can be sent again. */
  async markFailed(admin: Me, id: number, note: string) {
    const payout = await payoutsRepo.find(id)
    if (!payout) throw notFound('payout')
    if (payout.status === 'Paid') throw new AppError(400, 'This payout has already been paid.')
    await payoutsRepo.update(id, { status: 'Failed', note: note.slice(0, 300) })
    await auditLogRepo.record(admin, 'payout.failed', 'payout', id, { note })
    return (await payoutsRepo.find(id))!
  },

  all: (status: string | null) => payoutsRepo.list({ status: status as never }),

  /** Only used when an admin is about to make the transfer by hand. */
  async fullAccount(admin: Me, hostId: number) {
    const snap = await accountDoc(hostId).get()
    const a = snap.exists ? (snap.data() as StoredAccount) : null
    if (!a?.accountEnc) throw new AppError(400, 'This host has no bank account saved.')
    await auditLogRepo.record(admin, 'payout.reveal', 'user', hostId, {})
    return { holder: a.holder, accountNumber: decryptSecret(a.accountEnc), ifsc: a.ifsc, bankName: a.bankName }
  },
}
