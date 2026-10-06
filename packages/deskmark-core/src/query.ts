import { parseNote, temporaryKey } from './note.ts'
import { dayNumber, formatInZone, parseDue, toInstant, type DateParts } from './time.ts'
import type { AgendaItem, CalendarGroup, SmartList } from './types.ts'

export function agendaFromMarkdown(path: string, markdown: string): AgendaItem[] {
  const parsed = parseNote(markdown, path)
  const items: AgendaItem[] = []
  if (parsed.fields.kind === 'todo') {
    const text = parsed.title ?? fileName(path)
    items.push({
      source: 'note',
      path,
      line: null,
      id: parsed.fields.id,
      temporaryKey: temporaryKey(path, text, 0),
      text,
      done: parsed.fields.status === 'done',
      due: parsed.fields.due,
      remind: parsed.fields.remind,
      priority: parsed.fields.priority,
      repeat: parsed.fields.repeat,
      repeatSupported: parsed.fields.repeatSupported
    })
  }
  for (const task of parsed.tasks) {
    items.push({
      source: 'inline',
      path,
      line: task.line,
      id: task.id,
      temporaryKey: task.temporaryKey,
      text: task.text,
      done: task.checked,
      due: task.due,
      remind: task.remind,
      priority: task.priority,
      repeat: task.repeat,
      repeatSupported: task.repeatSupported
    })
  }
  return items
}

export function isOverdue(item: Pick<AgendaItem, 'done' | 'due'>, now: Date, timeZone: string): boolean {
  if (item.done || !item.due) return false
  const due = parseDue(item.due)
  if (!due) return false
  if (!due.time) return dayNumber(localDate(now, timeZone)) > dayNumber(due)
  const instant = toInstant(item.due)
  return instant != null && now.getTime() > instant.getTime()
}

export function calendarGroup(item: Pick<AgendaItem, 'done' | 'due'>, now: Date, timeZone: string): CalendarGroup {
  const due = item.due ? parseDue(item.due) : null
  if (!due) return 'undated'
  if (!item.done && isOverdue(item, now, timeZone)) return 'overdue'
  const delta = dayNumber(due) - dayNumber(localDate(now, timeZone))
  if (delta <= 0) return 'today'
  if (delta <= 7) return 'next7'
  return 'later'
}

export function smartList(item: Pick<AgendaItem, 'done' | 'due'>, now: Date, timeZone: string): SmartList {
  if (item.done) return 'done'
  const group = calendarGroup(item, now, timeZone)
  if (group === 'undated') return 'inbox'
  if (group === 'overdue') return 'overdue'
  if (group === 'today') return 'today'
  return 'upcoming'
}

export function tasksOnDate(items: AgendaItem[], day: string): AgendaItem[] {
  return items.filter(item => item.due?.slice(0, 10) === day)
}

export function tasksForAgenda<T extends { done: boolean, due: string | null, text: string }>(
  items: readonly T[],
  mode: { kind: 'day', day: string } | { kind: 'group', group: CalendarGroup },
  now: Date,
  timeZone: string
): T[] {
  const matched = items.filter(item => {
    if (mode.kind === 'day') return item.due?.slice(0, 10) === mode.day
    if (item.done) return false
    return calendarGroup(item, now, timeZone) === mode.group
  })
  return [...matched].sort((left, right) => Number(left.done) - Number(right.done) || left.text.localeCompare(right.text))
}

export function agendaCounts<T extends { done: boolean, due: string | null }>(
  items: readonly T[],
  now: Date,
  timeZone: string
): Record<CalendarGroup, number> {
  const counts: Record<CalendarGroup, number> = { overdue: 0, today: 0, next7: 0, later: 0, undated: 0 }
  for (const item of items) {
    if (item.done) continue
    counts[calendarGroup(item, now, timeZone)] += 1
  }
  return counts
}

export function markedDates(items: AgendaItem[]): string[] {
  const dates = items.flatMap(item => {
    if (item.done || !item.due) return []
    return [item.due.slice(0, 10)]
  })
  return [...new Set(dates)].sort()
}

function localDate(now: Date, timeZone: string): DateParts {
  const parsed = parseDue(formatInZone(now, timeZone).slice(0, 10))
  if (!parsed) throw new Error('无法计算本地日期')
  return parsed
}

function fileName(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}
