// Keeping dates straight with the other places a client lists their stay.
//
// Airbnb, Booking.com, Vrbo and the rest all speak the same thing for this: an iCalendar (.ics)
// feed. Each gives you a link holding its booked dates, and each will read one of yours. Two links
// per stay — theirs into us, ours into them — and neither side can sell the same night twice.
//
// It is a poll rather than a push: we read theirs every time the sync runs, and they read ours on
// their own schedule (Airbnb's is a couple of hours). Dates are never instant to the second, which
// is why the hold on a night here starts the moment a guest begins paying.

export type SyncPlatform = 'airbnb' | 'booking' | 'vrbo' | 'agoda' | 'makemytrip' | 'other'

export const SYNC_PLATFORMS: { value: SyncPlatform; label: string; where: string }[] = [
  { value: 'airbnb', label: 'Airbnb', where: 'Listing → Availability → Calendar sync → Export calendar' },
  { value: 'booking', label: 'Booking.com', where: 'Extranet → Rates & Availability → Calendar sync' },
  { value: 'vrbo', label: 'Vrbo', where: 'Listing → Calendar → Import & export' },
  { value: 'agoda', label: 'Agoda', where: 'YCS → Calendar → iCal sync' },
  { value: 'makemytrip', label: 'MakeMyTrip', where: 'Ingommt → Calendar → iCal' },
  { value: 'other', label: 'Somewhere else', where: 'Look for "export calendar", "iCal" or "ICS" in its calendar settings' },
]

export type FeedStatus = 'new' | 'ok' | 'failing'

export interface CalendarFeed {
  id: string
  propertyId: number
  platform: SyncPlatform
  /** What the client calls it, e.g. "Airbnb — Coorg cottage". */
  name: string
  /** The .ics link copied from the other platform. */
  url: string
  status: FeedStatus
  lastSyncedAt: string | null
  /** Why the last read failed, in words the client can act on. */
  lastError: string
  /** Dates held by the other platform at the last read. */
  blockedNights: number
  /** Nights the other platform has booked that Meridian has also sold. Needs a human. */
  clashes: string[]
  createdAt: string
}

export interface PropertySync {
  propertyId: number
  title: string
  /** The link the client pastes into the other platforms so they can read Meridian's dates. */
  exportUrl: string
  feeds: CalendarFeed[]
}

export const FEED_LIMIT_PER_PROPERTY = 6

/** An .ics link, as far as we can tell before fetching it. */
export const looksLikeFeedUrl = (url: string) => /^https?:\/\/\S+$/i.test(url.trim())

/**
 * Airbnb's export links look like
 * https://www.airbnb.com/calendar/ical/12345.ics?s=<token> — a warning when it is clearly the
 * listing page rather than the calendar link saves a round of confusion.
 */
export function feedUrlProblem(url: string): string | null {
  const u = url.trim()
  if (!looksLikeFeedUrl(u)) return 'Paste the whole link, starting with https://'
  if (/airbnb\.[a-z.]+\/(rooms|h)\//i.test(u)) return 'That is the listing page. In Airbnb, open Availability → Calendar sync → Export calendar and copy that link.'
  if (!/\.ics(\?|$)/i.test(u) && !/ical/i.test(u)) return 'That does not look like a calendar link. It usually ends in .ics'
  return null
}
