import { addDays, dayNumber, formatDate, formatInZone, parseDue, toInstant, type DateParts } from './time.ts'
import type { AgendaItem, CalendarGroup, SmartList } from './types.ts'

export type { CalendarGroup }

export const DEADLINE_WARNING_DAYS = 3

type AgendaSortable = {
  done?: boolean
  status?: string
  due: string | null
  text: string
  priority?: string | null
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
  return [...matched].sort((left, right) => compareAgenda(left, right))
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

export function compareAgenda(left: AgendaSortable, right: AgendaSortable): number {
  const doneDelta = Number(isDone(left)) - Number(isDone(right))
  if (doneDelta) return doneDelta
  const priorityDelta = priorityRank(left.priority) - priorityRank(right.priority)
  if (priorityDelta) return priorityDelta
  const dueDelta = dueRank(left.due).localeCompare(dueRank(right.due))
  if (dueDelta) return dueDelta
  return left.text.localeCompare(right.text)
}

export interface DayBridge<T> {
  onDay: T[]
  carried: T[]
  soon: T[]
  undated: T[]
}

export function bridgeForDay<T extends AgendaSortable>(
  items: readonly T[],
  day: string,
  now: Date,
  timeZone: string
): DayBridge<T> {
  const today = formatInZone(now, timeZone).slice(0, 10)
  const horizon = shiftDay(today, DEADLINE_WARNING_DAYS)
  const onDay = items.filter(item => item.due?.slice(0, 10) === day)
  const carried = day === today
    ? items.filter(item => !isDone(item) && Boolean(item.due) && item.due!.slice(0, 10) < day)
    : []
  const soon = day === today
    ? items.filter(item => {
      if (isDone(item) || !item.due || !horizon) return false
      const dueDay = item.due.slice(0, 10)
      return dueDay > day && dueDay <= horizon
    })
    : []
  const undated = items.filter(item => !isDone(item) && !item.due)
  return {
    onDay: [...onDay].sort((left, right) => compareAgenda(left, right)),
    carried: [...carried].sort((left, right) => compareAgenda(left, right)),
    soon: [...soon].sort((left, right) => compareAgenda(left, right)),
    undated: [...undated].sort((left, right) => compareAgenda(left, right))
  }
}

function isDone(item: { done?: boolean, status?: string }): boolean {
  if (typeof item.done === 'boolean') return item.done
  return item.status === 'done'
}

function priorityRank(priority: string | null | undefined): number {
  if (priority === 'high') return 0
  if (priority === 'low') return 2
  return 1
}

function dueRank(due: string | null): string {
  if (!due) return '9'
  const day = due.slice(0, 10)
  return due.includes('T') ? `0${day}${due}` : `1${day}`
}

function shiftDay(day: string, days: number): string | null {
  const parsed = parseDue(day)
  if (!parsed) return null
  return formatDate(addDays(parsed, days))
}

function localDate(now: Date, timeZone: string): DateParts {
  const parsed = parseDue(formatInZone(now, timeZone).slice(0, 10))
  if (!parsed) throw new Error('无法计算本地日期')
  return parsed
}
