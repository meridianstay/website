// Paying hosts what they have earned. Every booking already works out the host's share and
// Meridian's commission; this is the part that collects where to send it, decides when it becomes
// payable, and keeps a record of what was actually sent.

/** Where a host wants their money. Stored encrypted; views only ever carry the last four digits. */
export interface BankAccount {
  holder: string
  accountNumber: string
  ifsc: string
  bankName: string
  /** An alternative to the bank account for smaller amounts. */
  upiId: string
  /** Needed on invoices and for tax at source. */
  pan: string
}

/** What a host or an admin sees: enough to recognise the account, never enough to use it. */
export interface PayoutAccountView {
  holder: string
  /** "••••3417", or empty when nothing is saved. */
  maskedAccount: string
  ifsc: string
  bankName: string
  upiId: string
  pan: string
  /** True once there is enough to actually send money. */
  complete: boolean
  updatedAt: string | null
}

export const isIfsc = (v: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.trim().toUpperCase())
export const isAccountNumber = (v: string) => /^\d{9,18}$/.test(v.trim())
export const isUpiId = (v: string) => /^[\w.\-]{2,}@[a-z]{2,}$/i.test(v.trim())
export const isPan = (v: string) => /^[A-Z]{5}\d{4}[A-Z]$/.test(v.trim().toUpperCase())

export const maskAccount = (number: string) => (number ? `••••${number.slice(-4)}` : '')

/**
 * Due → Processing (money sent, waiting to land) → Paid. OnHold pauses a host's payouts;
 * Failed means the transfer bounced and the earnings go back to Due.
 */
export type PayoutStatus = 'Due' | 'Processing' | 'Paid' | 'Failed' | 'OnHold'

/** One booking inside a payout, so a host can see exactly what they are being paid for. */
export interface PayoutLine {
  bookingCode: string
  property: string
  checkIn: string
  checkOut: string
  /** What the guest paid, less any refund. */
  gross: number
  commissionPct: number
  commission: number
  net: number
}

export interface Payout {
  id: number
  hostId: number
  hostName: string
  /** The earliest and latest check-out in this payout. */
  periodStart: string
  periodEnd: string
  lines: PayoutLine[]
  gross: number
  commission: number
  net: number
  status: PayoutStatus
  method: 'bank' | 'upi'
  /** Where it went, as it looked when it was sent. */
  account: string
  /** The bank's reference number (UTR), so a host can trace it. */
  reference: string
  note: string
  createdAt: string
  paidAt: string | null
}

export interface PayoutSettings {
  /**
   * Days after check-out before earnings can be paid out. It covers late cancellations and
   * complaints, and is the single most important number here.
   */
  holdDays: number
  /** Nothing smaller than this is paid, so tiny transfers don't cost more than they carry. */
  minimumPayout: number
  /** How often your team runs payouts. Meridian doesn't send money on its own. */
  schedule: 'weekly' | 'fortnightly' | 'monthly' | 'manual'
}

export const defaultPayouts: PayoutSettings = { holdDays: 2, minimumPayout: 500, schedule: 'weekly' }

export const PAYOUT_SCHEDULES: { value: PayoutSettings['schedule']; label: string; explain: string }[] = [
  { value: 'weekly', label: 'Every week', explain: 'Run payouts once a week, e.g. every Monday.' },
  { value: 'fortnightly', label: 'Every two weeks', explain: 'Half the transfers, a little more in each.' },
  { value: 'monthly', label: 'Every month', explain: 'Fewest transfers; hosts wait longest.' },
  { value: 'manual', label: 'Whenever we choose', explain: 'No promised day. Hosts still see what they are owed.' },
]

/** The date on or before which a check-out must have happened for its earnings to be payable. */
export const payableUpTo = (today: string, holdDays: number) => {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - Math.max(0, holdDays))
  return d.toISOString().slice(0, 10)
}

/** What a host is owed right now, and what is still inside its hold period. */
export interface PayoutSummary {
  due: number
  dueLines: PayoutLine[]
  /** Earned, but the hold period hasn't passed yet. */
  pending: number
  /** Sent and waiting to land. */
  processing: number
  paidToDate: number
}
