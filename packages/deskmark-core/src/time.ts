export interface DateParts {
  y: number
  m: number
  d: number
  time: string | null
  offset: string | null
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2}))?$/

export function parseDue(value: string): DateParts | null {
  const match = DATE_RE.exec(value.trim())
  if (!match) return null
  return {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
    time: match[4] ? `${match[4]}:${match[5]}:${match[6]}` : null,
    offset: match[7] ? (match[7] === 'Z' ? '+00:00' : match[7]) : null
  }
}

export function formatDate(parts: Pick<DateParts, 'y' | 'm' | 'd'>): string {
  return `${String(parts.y).padStart(4, '0')}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`
}

export function dayNumber(parts: Pick<DateParts, 'y' | 'm' | 'd'>): number {
  return Math.floor(Date.UTC(parts.y, parts.m - 1, parts.d) / 86400000)
}

export function addDays(parts: Pick<DateParts, 'y' | 'm' | 'd'>, days: number): Pick<DateParts, 'y' | 'm' | 'd'> {
  const date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days))
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
}

export function addMonths(parts: Pick<DateParts, 'y' | 'm' | 'd'>, months: number): Pick<DateParts, 'y' | 'm' | 'd'> {
  const monthIndex = parts.m - 1 + months
  const lastDay = new Date(Date.UTC(parts.y, monthIndex + 1, 0)).getUTCDate()
  const date = new Date(Date.UTC(parts.y, monthIndex, Math.min(parts.d, lastDay)))
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
}

export function shiftDue(due: string, repeat: 'daily' | 'weekly' | 'monthly'): string | null {
  const parsed = parseDue(due)
  if (!parsed) return null
  const next = repeat === 'monthly'
    ? addMonths(parsed, 1)
    : addDays(parsed, repeat === 'weekly' ? 7 : 1)
  const date = formatDate(next)
  if (!parsed.time || !parsed.offset) return date
  return `${date}T${parsed.time}${parsed.offset}`
}

export function moveDueToDay(due: string | null, day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  if (!due) return day
  const parsed = parseDue(due)
  if (!parsed?.time || !parsed.offset) return day
  return `${day}T${parsed.time}${parsed.offset}`
}

export function shiftRemind(due: string, remind: string, advancedDue: string): string | null {
  const dueParts = parseDue(due)
  const remindParts = parseDue(remind)
  const advancedParts = parseDue(advancedDue)
  if (!dueParts || !remindParts || !advancedParts) return null
  const delta = dayNumber(remindParts) - dayNumber(dueParts)
  const shifted = addDays(advancedParts, delta)
  const date = formatDate(shifted)
  if (!remindParts.time || !remindParts.offset) return date
  return `${date}T${remindParts.time}${remindParts.offset}`
}

export function toInstant(value: string): Date | null {
  const parsed = parseDue(value)
  if (!parsed?.time || !parsed.offset) return null
  const [hour, minute, second] = parsed.time.split(':').map(Number)
  const sign = parsed.offset.startsWith('-') ? -1 : 1
  const [offsetHour, offsetMinute] = parsed.offset.slice(1).split(':').map(Number)
  const utc = Date.UTC(parsed.y, parsed.m - 1, parsed.d, hour, minute, second) - sign * ((offsetHour * 60) + offsetMinute) * 60000
  return new Date(utc)
}

export function formatInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset'
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  let hour = read('hour')
  if (hour === '24') hour = '00'
  return `${read('year')}-${read('month')}-${read('day')}T${hour}:${read('minute')}:${read('second')}${normalizeOffset(read('timeZoneName'))}`
}

function normalizeOffset(name: string): string {
  if (name === 'GMT' || name === 'UTC') return '+00:00'
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name)
  if (!match) return '+00:00'
  return `${match[1]}${match[2].padStart(2, '0')}:${match[3] ?? '00'}`
}

export function localDateTimeToIso(value: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes(new Date(utc), timeZone) * 60000
    if (next === utc) break
    utc = next
  }
  return formatInZone(new Date(utc), timeZone)
}

function offsetMinutes(date: Date, timeZone: string): number {
  const match = /([+-])(\d{2}):(\d{2})$/.exec(formatInZone(date, timeZone))
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3]))
}
