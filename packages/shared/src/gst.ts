// GST on a booking.
//
// Indian accommodation is taxed by what a unit costs per day: at the time of writing, 5% up to
// ₹7,500 a night and 18% above it (the two-slab structure from 22 September 2025, which replaced
// the old 12% band). Those numbers are settings rather than constants, because rates move and only
// the client's accountant can say which applies to them.
//
// Place of supply for accommodation is where the property is, so a stay in the same state as the
// registered business is CGST + SGST, and one in another state is IGST.

export interface GstSlab {
  /** Up to and including this much per night, in rupees. The last slab uses Infinity. */
  upTo: number
  /** Percent. */
  rate: number
  label: string
}

export interface GstSettings {
  /** Off until the business is registered and the details below are filled in. */
  enabled: boolean
  /** 15 characters, e.g. 29ABCDE1234F1Z5. */
  gstin: string
  /** The name GST is registered under, which may differ from the brand. */
  legalName: string
  address: string
  /** The state the business is registered in — the other half of deciding CGST+SGST or IGST. */
  stateCode: string
  /** Services Accounting Code for accommodation. 996311 is hotel and guest-house lodging. */
  sac: string
  /** What invoice numbers look like, e.g. MS/26-27/0001. */
  invoicePrefix: string
  /**
   * True when the price a guest sees already contains the tax, which is how this platform charges:
   * the tax is worked back out of what was collected rather than added on top of it.
   */
  pricesIncludeTax: boolean
  slabs: GstSlab[]
  /** Who the law treats as supplying the stay. Only an accountant can settle this. */
  supplier: 'platform' | 'host'
}

export const defaultGstSettings: GstSettings = {
  enabled: false,
  gstin: '',
  legalName: '',
  address: '',
  stateCode: '',
  sac: '996311',
  invoicePrefix: 'MS',
  pricesIncludeTax: true,
  slabs: [
    { upTo: 7500, rate: 5, label: 'Up to ₹7,500 a night' },
    { upTo: Number.MAX_SAFE_INTEGER, rate: 18, label: 'Above ₹7,500 a night' },
  ],
  supplier: 'platform',
}

/** The state codes GST uses, which are the first two digits of every GSTIN. */
export const GST_STATES: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu and Kashmir' }, { code: '02', name: 'Himachal Pradesh' }, { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' }, { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' }, { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' }, { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' }, { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' }, { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' }, { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' }, { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' }, { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' }, { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' }, { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' },
]

/** Maps the state a listing says it is in onto a GST state code. */
export function stateCodeOf(region: string): string {
  const want = region.trim().toLowerCase()
  const hit = GST_STATES.find((s) => s.name.toLowerCase() === want)
    ?? GST_STATES.find((s) => want.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(want))
  return hit?.code ?? ''
}

export const stateName = (code: string) => GST_STATES.find((s) => s.code === code)?.name ?? ''

/** 15 characters: two for the state, ten for the PAN, then an entity digit, a Z, and a check character. */
export const isGstin = (value: string) => /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value.trim().toUpperCase())

/** The rate for a night at this price. */
export function rateFor(slabs: GstSlab[], perNight: number): GstSlab {
  const sorted = [...slabs].sort((a, b) => a.upTo - b.upTo)
  return sorted.find((s) => perNight <= s.upTo) ?? sorted[sorted.length - 1]
}

export interface TaxLines {
  /** What the stay is worth before tax. */
  taxable: number
  rate: number
  cgst: number
  sgst: number
  igst: number
  tax: number
  total: number
  /** True when supplier and property are in different states. */
  interState: boolean
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * Splits an amount into what it is worth and the tax on it. With tax-inclusive pricing the tax is
 * taken out of the total; otherwise it is added to it. CGST and SGST are half the rate each, and
 * they are replaced by a single IGST when the supply crosses a state line.
 */
export function taxLines(amount: number, perNight: number, settings: GstSettings, propertyStateCode: string): TaxLines {
  const { rate } = rateFor(settings.slabs, perNight)
  const taxable = settings.pricesIncludeTax ? round(amount / (1 + rate / 100)) : round(amount)
  const tax = round(settings.pricesIncludeTax ? amount - taxable : (taxable * rate) / 100)
  const interState = !!settings.stateCode && !!propertyStateCode && settings.stateCode !== propertyStateCode
  const half = round(tax / 2)
  return {
    taxable,
    rate,
    cgst: interState ? 0 : half,
    // The halves must still add to the whole when the tax ends in an odd paisa.
    sgst: interState ? 0 : round(tax - half),
    igst: interState ? tax : 0,
    tax,
    total: round(taxable + tax),
    interState,
  }
}

export type InvoiceKind = 'booking' | 'cancellation'

/** A tax invoice, kept exactly as it was issued. Nothing about one is ever recalculated. */
export interface Invoice {
  /** The number on the document, e.g. MS/26-27/0007. Never reused, never reordered. */
  number: string
  /** Running count within the financial year, which is what the number is built from. */
  serial: number
  /** The Indian financial year it falls in, e.g. "26-27". */
  financialYear: string
  kind: InvoiceKind
  bookingCode: string
  issuedAt: string
  /** Who is supplying, copied in full so a later settings change can't alter a past invoice. */
  supplier: { legalName: string; gstin: string; address: string; stateCode: string }
  /** Who it is for. A guest without a GSTIN is an unregistered recipient, which is normal. */
  recipient: { name: string; email: string | null; phone: string | null; gstin: string | null }
  /** Where the supply happened, which for a stay is where the property is. */
  placeOfSupply: { stateCode: string; stateName: string }
  description: string
  sac: string
  nights: number
  perNight: number
  lines: TaxLines
  /** A credit note points back at the invoice it reverses. */
  against: string | null
}

/** April to March. A number issued in March belongs to the year that is ending. */
export function financialYear(iso: string): string {
  const d = new Date(iso)
  const year = d.getUTCFullYear()
  const start = d.getUTCMonth() >= 3 ? year : year - 1
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`
}

export const invoiceNumber = (prefix: string, year: string, serial: number) =>
  `${prefix || 'MS'}/${year}/${String(serial).padStart(4, '0')}`
