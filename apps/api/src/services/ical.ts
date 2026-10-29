// iCalendar, read and written by hand. The format is older than most of what reads it and the part
// we need is small: events with a start date and an end date. Writing it is smaller still.
//
// Every other booking platform speaks this, which is why it is what we sync with.

export interface CalEvent {
  /** First night taken. */
  start: string
  /** The morning it is free again — the same way check-out works here. */
  end: string
  summary: string
  uid: string
}

/** Long lines in an .ics file are wrapped, with the continuation starting with a space or tab. */
function unfold(text: string): string[] {
  const out: string[] = []
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && out.length) out[out.length - 1] += raw.slice(1)
    else out.push(raw)
  }
  return out
}

/**
 * Text in an .ics file escapes the characters that would otherwise separate fields. Undone in one
 * pass, so a stay called "Green Valley; Coorg" comes back as it went in.
 */
function unescape(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === 'n' || ch === 'N' ? ' ' : ch))
}

/** 20261101 or 20261101T100000Z, both of which mean the same day to us. */
function toISODate(value: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value.trim())
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/** The events in an .ics file. Anything we can't read is skipped rather than failing the whole feed. */
export function parseICS(text: string): CalEvent[] {
  const events: CalEvent[] = []
  let current: Partial<CalEvent> | null = null

  for (const line of unfold(text)) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = {}
      continue
    }
    if (line.startsWith('END:VEVENT')) {
      if (current?.start && current.end && current.end > current.start) {
        events.push({ start: current.start, end: current.end, summary: current.summary ?? '', uid: current.uid ?? `${current.start}/${current.end}` })
      }
      current = null
      continue
    }
    if (!current) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const name = line.slice(0, colon).split(';')[0].toUpperCase()
    const value = line.slice(colon + 1)
    if (name === 'DTSTART') current.start = toISODate(value) ?? undefined
    else if (name === 'DTEND') current.end = toISODate(value) ?? undefined
    else if (name === 'SUMMARY') current.summary = unescape(value).slice(0, 200)
    else if (name === 'UID') current.uid = value.slice(0, 200)
  }
  return events
}

const stamp = (iso: string) => iso.replace(/-/g, '')
const escape = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')

/** Splits a long line the way the format wants, at 75 characters. */
const fold = (line: string) => line.match(/.{1,73}/g)?.join('\r\n ') ?? line

/** An .ics feed of our own, for the other platforms to read. */
export function buildICS(name: string, events: CalEvent[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BookMyGetaway//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(name)}`,
  ]
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escape(e.uid)}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${stamp(e.start)}`,
      `DTEND;VALUE=DATE:${stamp(e.end)}`,
      `SUMMARY:${escape(e.summary)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
