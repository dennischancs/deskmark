export interface MonthCell {
  date: string | null
  day: number | null
  marked: boolean
}

export function buildMonth(year: number, month: number, marked: readonly string[]): MonthCell[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const leading = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const marks = new Set(marked)
  const cells: MonthCell[] = []
  for (let index = 0; index < leading; index += 1) cells.push({ date: null, day: null, marked: false })
  for (let day = 1; day <= days; day += 1) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ date, day, marked: marks.has(date) })
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null, marked: false })
  return cells
}

export function weekdayLabels(locale: string): string[] {
  const monday = new Date(Date.UTC(2026, 0, 5))
  const format = new Intl.DateTimeFormat(locale || 'en', { weekday: 'narrow', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_value, index) => {
    return format.format(new Date(monday.getTime() + index * 86_400_000))
  })
}

export function shouldOpenAtMention(text: string): boolean {
  return /(?:^|\s)@\S*$/.test(text) && !/\w@\S*$/.test(text)
}

export function slashQuery(text: string): string | null {
  const match = /^[/、](\S*)$/.exec(text)
  return match ? match[1] : null
}

export type QuickAction = 'todo' | 'date' | 'remind' | 'journal' | 'today' | 'tomorrow' | 'note'

export function applyQuickAction(paragraph: string, action: QuickAction, options: {
  today: string
  tomorrow: string
  remind: string
  journalHref: string
  noteLabel?: string
  noteHref?: string
  id: string
}): { text: string, asTask: boolean } {
  const body = stripTrigger(paragraph).trim()
  if (action === 'journal') {
    return { text: `${body ? `${body} ` : ''}[${options.today}](${options.journalHref})`.trim(), asTask: false }
  }
  if (action === 'note' && options.noteHref) {
    const label = options.noteLabel || options.noteHref
    return { text: `${body ? `${body} ` : ''}[${label}](${options.noteHref})`.trim(), asTask: false }
  }
  const due = action === 'tomorrow' ? options.tomorrow : options.today
  const comment = action === 'remind'
    ? `<!-- deskmark: id=${options.id}; remind=${options.remind} -->`
    : action === 'todo'
      ? ''
      : `<!-- deskmark: id=${options.id}; due=${due} -->`
  const text = [body, comment].filter(Boolean).join(' ')
  return { text, asTask: true }
}

function stripTrigger(paragraph: string): string {
  if (/^[/、]\S*$/.test(paragraph)) return ''
  return paragraph.replace(/(?:^|\s)@\S*$/, '').trim()
}
