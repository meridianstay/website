import { financialYear, invoiceNumber, type Invoice } from '@meridian/shared'
import { C, col, firestore, nowISO } from '../store/db'

// Collection: invoices/{number-with-slashes-replaced}. An invoice is written once and never
// touched again: a tax document that changes is not a tax document. A booking that is cancelled
// gets a credit note of its own pointing back at the original.

const docId = (number: string) => number.replace(/\//g, '-')

export const invoicesRepo = {
  async find(number: string): Promise<Invoice | null> {
    const snap = await col(C.invoices).doc(docId(number)).get()
    return snap.exists ? (snap.data() as Invoice) : null
  },

  /** Every invoice raised for a booking: the invoice itself, and any credit note against it. */
  async forBooking(bookingCode: string): Promise<Invoice[]> {
    const snap = await col(C.invoices).where('bookingCode', '==', bookingCode).get()
    return snap.docs.map((d) => d.data() as Invoice).sort((a, b) => a.issuedAt.localeCompare(b.issuedAt))
  },

  /**
   * Every document raised against a set of bookings — how a guest sees their own invoices and
   * credit notes in one place. Firestore takes at most thirty values in an `in`, so a frequent
   * traveller's codes go up in batches.
   */
  async forBookings(codes: string[]): Promise<Invoice[]> {
    const batches: string[][] = []
    for (let i = 0; i < codes.length; i += 30) batches.push(codes.slice(i, i + 30))
    const results = await Promise.all(batches.map((batch) => col(C.invoices).where('bookingCode', 'in', batch).get()))
    return results
      .flatMap((snap) => snap.docs.map((d) => d.data() as Invoice))
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  },

  /** Everything raised for one client's stays, theirs and Book My Get Away's alike. */
  async byHost(hostId: number): Promise<Invoice[]> {
    const snap = await col(C.invoices).where('hostId', '==', hostId).get()
    return snap.docs.map((d) => d.data() as Invoice).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  },

  async list(filter: { financialYear?: string; month?: string } = {}): Promise<Invoice[]> {
    const snap = await col(C.invoices).get()
    return snap.docs
      .map((d) => d.data() as Invoice)
      .filter((i) => (!filter.financialYear || i.financialYear === filter.financialYear)
        && (!filter.month || i.issuedAt.slice(0, 7) === filter.month))
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  },

  /**
   * Writes an invoice with the next number in its financial year. The serial is taken inside a
   * transaction, so two bookings paid at the same moment can never be given the same number — and
   * the series has no gaps, which is what a tax auditor looks for first.
   */
  async issue(draft: Omit<Invoice, 'number' | 'serial' | 'financialYear' | 'issuedAt'>, prefix: string): Promise<Invoice> {
    const issuedAt = nowISO()
    const year = financialYear(issuedAt)
    return firestore.runTransaction(async (tx) => {
      const counter = col(C.counters).doc(`invoices-${year}`)
      const snap = await tx.get(counter)
      const serial = ((snap.data()?.value as number | undefined) ?? 0) + 1
      const invoice: Invoice = { ...draft, serial, financialYear: year, issuedAt, number: invoiceNumber(prefix, year, serial) }
      tx.set(counter, { value: serial })
      tx.create(col(C.invoices).doc(docId(invoice.number)), invoice)
      return invoice
    })
  },
}
