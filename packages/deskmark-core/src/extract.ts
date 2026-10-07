import { agendaFromMarkdown } from './query.ts'
import { parseDue } from './time.ts'
import type { AgendaItem } from './types.ts'

export interface ExtractRules {
  taskLine: boolean
  commentMeta: boolean
  frontMatter: boolean
  dateInText: boolean
  extraPrefixes: string[]
}

export const DEFAULT_EXTRACT_RULES: ExtractRules = {
  taskLine: true,
  commentMeta: true,
  frontMatter: true,
  dateInText: false,
  extraPrefixes: []
}

const DATE_IN_TEXT = /(?:^|[^\d])(\d{4}-\d{2}-\d{2})(?!\d)/

export function agendaForIndex(path: string, markdown: string, rules: ExtractRules = DEFAULT_EXTRACT_RULES): AgendaItem[] {
  const parsed = agendaFromMarkdown(path, markdown)
  const items: AgendaItem[] = []
  for (const item of parsed) {
    if (item.source === 'note' && !rules.frontMatter) continue
    if (item.source === 'inline' && !rules.taskLine) continue
    items.push(rules.commentMeta || item.source === 'note' ? item : withoutCommentMeta(item))
  }
  if (rules.extraPrefixes.length) {
    const taken = new Set(items.filter(item => item.line != null).map(item => item.line))
    for (const extra of tasksFromPrefixes(path, markdown, rules.extraPrefixes)) {
      if (extra.line != null && taken.has(extra.line)) continue
      items.push(extra)
    }
  }
  if (!rules.dateInText) return items
  return items.map(item => item.due ? item : { ...item, due: dateInText(item.text) })
}

function withoutCommentMeta(item: AgendaItem): AgendaItem {
  return {
    ...item,
    due: null,
    remind: null,
    priority: 'normal',
    repeat: 'none',
    repeatSupported: true
  }
}

function dateInText(text: string): string | null {
  const match = DATE_IN_TEXT.exec(text)
  if (!match) return null
  return parseDue(match[1]) ? match[1] : null
}

function tasksFromPrefixes(path: string, markdown: string, prefixes: string[]): AgendaItem[] {
  const wanted = prefixes.map(prefix => prefix.trim()).filter(prefix => prefix.length > 0)
  if (!wanted.length) return []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const items: AgendaItem[] = []
  let fence: string | null = null
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    const fenceMatch = /^(`{3,}|~{3,})/.exec(trimmed)
    if (fence) {
      if (trimmed.startsWith(fence)) fence = null
      return
    }
    if (fenceMatch) {
      fence = fenceMatch[1]
      return
    }
    const indent = /^(\s*)/.exec(line)?.[1] ?? ''
    const body = line.slice(indent.length)
    const prefix = wanted.find(item => body.startsWith(item))
    if (!prefix) return
    const text = body.slice(prefix.length).trim()
    if (!text) return
    items.push({
      source: 'inline',
      path,
      line: index + 1,
      id: null,
      temporaryKey: `${path}#prefix@${index + 1}`,
      text,
      done: false,
      due: null,
      remind: null,
      priority: 'normal',
      repeat: 'none',
      repeatSupported: true
    })
  })
  return items
}
