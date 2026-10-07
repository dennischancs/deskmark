export interface IcsTask {
  path: string
  line: number | null
  id: string | null
  text: string
  due: string | null
  done: boolean
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function dateStamp(due: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(due)
  if (!match) return null
  return `${match[1]}${match[2]}${match[3]}`
}

function utcStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function fold(line: string): string {
  const bytes = encoder.encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let start = 0
  let limit = 75
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length)
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1
    if (end === start) end = Math.min(start + limit, bytes.length)
    parts.push(decoder.decode(bytes.subarray(start, end)))
    start = end
    limit = 74
  }
  return parts.map((part, index) => index === 0 ? part : ` ${part}`).join('\r\n')
}

export function tasksToIcs(tasks: readonly IcsTask[], now: Date): string {
  const stamp = utcStamp(now)
  const events: string[] = []
  const sorted = [...tasks].sort((left, right) => {
    const due = (left.due ?? '').localeCompare(right.due ?? '')
    if (due !== 0) return due
    const path = left.path.localeCompare(right.path)
    if (path !== 0) return path
    return (left.line ?? 0) - (right.line ?? 0)
  })
  for (const task of sorted) {
    if (!task.due) continue
    const day = dateStamp(task.due)
    if (!day) continue
    const uid = escapeText(task.id && task.id.trim() ? task.id : `${task.path}#${task.line ?? 0}`)
    const summary = escapeText(task.text.trim() || task.path)
    events.push(
      [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${escapeText(task.path)}`,
        'END:VEVENT'
      ].map(fold).join('\r\n')
    )
  }
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Deskmark//Deskmark//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
    ''
  ].join('\r\n')
}
