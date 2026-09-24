// Telling people what happened: a booking confirmed, a request waiting for a host, a refund on its
// way. Firebase only sends sign-in codes, so everything else goes out from here — by email, by SMS,
// or both. Which provider to use and what each message says is set in the control centre.

/** Everything the platform can tell someone about. */
export type NotificationEvent =
  | 'booking.confirmed'
  | 'booking.requested'
  | 'booking.accepted'
  | 'booking.declined'
  | 'booking.cancelled'
  | 'booking.hostCancelled'
  | 'booking.reminder'
  | 'review.invite'
  | 'listing.approved'
  | 'listing.rejected'
  | 'promotion.approved'
  | 'promotion.rejected'

export type Audience = 'guest' | 'host'

export interface EventDefinition {
  event: NotificationEvent
  to: Audience
  label: string
  when: string
  /** Placeholders this message can use, beyond the ones every message has. */
  tokens: string[]
}

/** Tokens available in every message, so a template can always greet someone properly. */
export const COMMON_TOKENS = ['name', 'site', 'code', 'property', 'link'] as const

export const NOTIFICATION_EVENTS: EventDefinition[] = [
  { event: 'booking.confirmed', to: 'guest', label: 'Booking confirmed', when: 'A guest pays and the stay is confirmed', tokens: ['dates', 'guests', 'total', 'address', 'hostName', 'hostPhone'] },
  { event: 'booking.requested', to: 'host', label: 'New booking request', when: 'A guest asks to book a self-managed property', tokens: ['dates', 'guests', 'total', 'guestName', 'answerBy'] },
  { event: 'booking.accepted', to: 'guest', label: 'Request accepted', when: 'The host accepts a request and the payment is taken', tokens: ['dates', 'total', 'address', 'hostName', 'hostPhone'] },
  { event: 'booking.declined', to: 'guest', label: 'Request declined', when: 'The host declines, or does not answer in time', tokens: ['dates', 'reason'] },
  { event: 'booking.cancelled', to: 'guest', label: 'Booking cancelled', when: 'A guest cancels their own booking', tokens: ['dates', 'refund', 'fee'] },
  { event: 'booking.hostCancelled', to: 'host', label: 'A guest cancelled', when: 'A guest cancels a booking at this property', tokens: ['dates', 'guestName'] },
  { event: 'booking.reminder', to: 'guest', label: 'Check-in reminder', when: 'The day before check-in', tokens: ['dates', 'address', 'hostName', 'hostPhone', 'checkInTime'] },
  { event: 'review.invite', to: 'guest', label: 'How was your stay?', when: 'The day after check-out', tokens: ['dates'] },
  { event: 'listing.approved', to: 'host', label: 'Listing is live', when: 'Our team approves a listing', tokens: [] },
  { event: 'listing.rejected', to: 'host', label: 'Listing needs changes', when: 'Our team asks for changes', tokens: ['reason'] },
  { event: 'promotion.approved', to: 'host', label: 'Promotion approved', when: 'A paid promotion is approved', tokens: ['dates', 'total'] },
  { event: 'promotion.rejected', to: 'host', label: 'Promotion rejected', when: 'A paid promotion is rejected and refunded', tokens: ['reason', 'total'] },
]

export interface MessageTemplate {
  /** Off means this event tells nobody, whatever the providers are set to. */
  enabled: boolean
  email: boolean
  sms: boolean
  subject: string
  /** Plain text. Blank lines separate paragraphs; {tokens} are filled in when it is sent. */
  body: string
  /** Kept short: one SMS is 160 characters, and Indian senders pay per part. */
  smsText: string
}

export type EmailProvider = 'none' | 'smtp'
export type SmsProvider = 'none' | 'msg91' | 'twilio'

export interface NotificationSettings {
  /** The name and address messages come from. */
  fromName: string
  fromEmail: string
  /** Replies go here when it is set, which is usually a real inbox someone watches. */
  replyTo: string
  email: EmailProvider
  sms: SmsProvider
  /** The six-character sender id Indian SMS gateways require, e.g. MERIDN. */
  smsSenderId: string
  templates: Record<NotificationEvent, MessageTemplate>
}

const template = (subject: string, body: string, smsText: string, sms = false): MessageTemplate =>
  ({ enabled: true, email: true, sms, subject, body, smsText })

export const defaultNotifications: NotificationSettings = {
  fromName: 'Meridian Stay',
  fromEmail: '',
  replyTo: '',
  email: 'none',
  sms: 'none',
  smsSenderId: '',
  templates: {
    'booking.confirmed': template(
      'Your stay at {property} is confirmed ({code})',
      'Hello {name},\n\nYour booking at {property} is confirmed.\n\nWhen: {dates}\nGuests: {guests}\nPaid: {total}\nBooking reference: {code}\n\nAddress: {address}\nYour host: {hostName}, {hostPhone}\n\nSee everything about this booking here: {link}\n\nSee you soon,\n{site}',
      '{site}: booking {code} at {property} is confirmed for {dates}. Details: {link}',
      true,
    ),
    'booking.requested': template(
      'New booking request for {property} ({code})',
      'Hello {name},\n\n{guestName} would like to book {property}.\n\nWhen: {dates}\nGuests: {guests}\nYou would receive: {total}\n\nPlease answer by {answerBy}, or the request expires and the guest is not charged.\n\nAccept or decline here: {link}\n\n{site}',
      '{site}: new request for {property}, {dates}. Answer by {answerBy}: {link}',
      true,
    ),
    'booking.accepted': template(
      'Your request for {property} was accepted ({code})',
      'Hello {name},\n\nGood news — your host accepted your request for {property}.\n\nWhen: {dates}\nPaid: {total}\nBooking reference: {code}\n\nAddress: {address}\nYour host: {hostName}, {hostPhone}\n\n{link}\n\n{site}',
      '{site}: your request for {property} was accepted for {dates}. Details: {link}',
      true,
    ),
    'booking.declined': template(
      'About your request for {property} ({code})',
      'Hello {name},\n\nYour host could not take your request for {property} on {dates}.\n\n{reason}\n\nYou have not been charged. Plenty of other places are free on those dates: {link}\n\n{site}',
      '{site}: your request for {property} on {dates} was not accepted. You have not been charged.',
    ),
    'booking.cancelled': template(
      'Your booking at {property} is cancelled ({code})',
      'Hello {name},\n\nYour booking at {property} for {dates} is cancelled.\n\nRefund: {refund}\nConvenience fee kept: {fee}\n\nRefunds usually reach your account in 5–7 working days.\n\n{site}',
      '{site}: booking {code} cancelled. Refund of {refund} is on its way.',
    ),
    'booking.hostCancelled': template(
      'A guest cancelled at {property} ({code})',
      'Hello {name},\n\n{guestName} cancelled their booking at {property} for {dates}.\n\nThose dates are open again on your calendar: {link}\n\n{site}',
      '{site}: {guestName} cancelled {dates} at {property}. The dates are free again.',
    ),
    'booking.reminder': template(
      'See you tomorrow at {property}',
      'Hello {name},\n\nYour stay at {property} starts tomorrow.\n\nCheck-in: from {checkInTime}\nAddress: {address}\nYour host: {hostName}, {hostPhone}\n\nHave a wonderful time,\n{site}',
      '{site}: check-in at {property} is tomorrow from {checkInTime}. Host: {hostPhone}',
      true,
    ),
    'review.invite': template(
      'How was your stay at {property}?',
      'Hello {name},\n\nWe hope your stay at {property} was everything you wanted.\n\nWould you tell other travellers how it went? It takes a minute: {link}\n\nThank you,\n{site}',
      '{site}: how was {property}? Leave a review here: {link}',
    ),
    'listing.approved': template(
      '{property} is live on {site}',
      'Hello {name},\n\n{property} has been approved and is now live. Guests can find and book it from today.\n\nManage it here: {link}\n\n{site}',
      '{site}: {property} is live and open for bookings.',
    ),
    'listing.rejected': template(
      '{property} needs a few changes',
      'Hello {name},\n\nWe looked at {property} and it needs a few changes before it can go live.\n\n{reason}\n\nEdit and resubmit here: {link}\n\n{site}',
      '{site}: {property} needs changes before it goes live. Details: {link}',
    ),
    'promotion.approved': template(
      'Your promotion for {property} is running',
      'Hello {name},\n\nYour promotion for {property} is approved and runs {dates}.\n\nPaid: {total}\n\nWatch how it performs here: {link}\n\n{site}',
      '{site}: your promotion for {property} is live, {dates}.',
    ),
    'promotion.rejected': template(
      'About your promotion for {property}',
      'Hello {name},\n\nWe could not run your promotion for {property}.\n\n{reason}\n\n{total} has been refunded in full.\n\n{site}',
      '{site}: promotion for {property} was not approved. {total} refunded in full.',
    ),
  },
}

/** Fills {tokens}. Anything missing is removed rather than left showing braces. */
export function fillTemplate(text: string, values: Record<string, string | number | null | undefined>): string {
  return text
    .replace(/\{(\w+)\}/g, (_, key) => {
      const value = values[key]
      return value === null || value === undefined ? '' : String(value)
    })
    // A token that resolved to nothing can leave a stray line or double space.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** How a message went out, for the log in the control centre. */
export type DeliveryChannel = 'email' | 'sms'
export type DeliveryStatus = 'sent' | 'failed' | 'skipped'

export interface NotificationLogEntry {
  id: number
  event: NotificationEvent
  channel: DeliveryChannel
  status: DeliveryStatus
  /** The address or number, shortened so the log doesn't become a contact list. */
  to: string
  subject: string
  /** Why it failed or was skipped. */
  detail: string
  bookingCode: string | null
  createdAt: string
}
