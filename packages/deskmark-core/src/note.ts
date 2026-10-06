import { createHash } from 'node:crypto'
import { formatInZone, parseDue, shiftDue, shiftRemind } from './time.ts'
import type { EditResult, FieldEntry, InlinePatch, NoteFields, ParsedNote, TaskItem } from './types.ts'
import { createUlid } from './ulid.ts'

const KNOWN_KEYS = ['id', 'kind', 'status', 'due', 'remind', 'priority', 'repeat', 'completed']
const KNOWN_REPEATS = new Set(['', 'none', 'daily', 'weekly', 'monthly'])

interface Lines {
  lines: string[]
  newline: string
}

export function repeatSupported(value: string | null | undefined): boolean {
  return KNOWN_REPEATS.has(value ?? '')
}

export function temporaryKey(path: string, text: string, line: number): string {
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 12)
  return `${path}#${hash}@${line}`
}

export function parseNote(markdown: string, path = ''): ParsedNote {
  const { lines } = splitLines(markdown)
  const front = readFrontMatter(lines)
  const fields = parseFields(front.fields)
  return {
    title: front.title,
    frontMatterError: front.error,
    fields,
    tasks: parseTasks(lines, path)
  }
}

export function updateInlineTask(
  markdown: string,
  lineNumber: number,
  patch: InlinePatch,
  allocateId: () => string = () => createUlid()
): EditResult {
  const parsed = parseNote(markdown)
  const task = parsed.tasks.find(item => item.line === lineNumber)
  if (!task) return unchanged(markdown, '这一行不是待办')
  const { lines, newline } = splitLines(markdown)
  const next = applyInlinePatch(task, patch, allocateId)
  lines[lineNumber - 1] = renderTaskLine(next)
  return { markdown: joinLines(lines, newline), changed: true, error: null, advanced: false, unsupportedRepeat: false }
}

export function completeInlineTask(
  markdown: string,
  lineNumber: number,
  now: Date,
  timeZone: string,
  allocateId: () => string = () => createUlid()
): EditResult {
  const parsed = parseNote(markdown)
  const task = parsed.tasks.find(item => item.line === lineNumber)
  if (!task) return unchanged(markdown, '这一行不是待办')
  const { lines, newline } = splitLines(markdown)
  const completed = formatInZone(now, timeZone)
  const finished = applyInlinePatch(task, { checked: true, completed }, allocateId)
  lines[lineNumber - 1] = renderTaskLine(finished)
  const canAdvance = !repeatSupported(task.repeat)
    ? false
    : task.repeat === 'daily' || task.repeat === 'weekly' || task.repeat === 'monthly'
  if (!canAdvance || !task.due) {
    return {
      markdown: joinLines(lines, newline),
      changed: true,
      error: null,
      advanced: false,
      unsupportedRepeat: !repeatSupported(task.repeat)
    }
  }
  const due = shiftDue(task.due, task.repeat as 'daily' | 'weekly' | 'monthly')
  if (!due) return unchanged(markdown, '截止日期无法往后推')
  const remind = task.remind ? shiftRemind(task.due, task.remind, due) : null
  const inserted = applyInlinePatch({
    ...task,
    checked: false,
    id: null,
    due,
    remind,
    completed: null
  }, { id: allocateId(), due, remind, completed: null, checked: false }, allocateId)
  lines.splice(lineNumber, 0, renderTaskLine(inserted))
  return { markdown: joinLines(lines, newline), changed: true, error: null, advanced: true, unsupportedRepeat: false }
}

export function completeNote(
  markdown: string,
  now: Date,
  timeZone: string,
  allocateId: () => string = () => createUlid()
): EditResult {
  const parsed = parseNote(markdown)
  if (parsed.fields.kind !== 'todo') return unchanged(markdown, '这篇不是待办笔记')
  const stamp = formatInZone(now, timeZone)
  const repeat = parsed.fields.repeat
  const supported = repeat === 'daily' || repeat === 'weekly' || repeat === 'monthly'
  const fields = { ...parsed.fields }
  let advanced = false
  const previousDue = fields.due
  if (supported && previousDue) {
    const due = shiftDue(previousDue, repeat)
    if (!due) return unchanged(markdown, '截止日期无法往后推')
    fields.due = due
    fields.remind = fields.remind ? shiftRemind(previousDue, fields.remind, due) : null
    fields.status = 'open'
    advanced = true
  } else {
    fields.status = 'done'
    fields.completed = stamp
  }
  if (!fields.id) fields.id = allocateId()
  const rewritten = rewriteFrontMatter(markdown, fields, parsed.frontMatterError)
  const withLog = advanced ? appendCompletion(rewritten, stamp) : rewritten
  return {
    markdown: withLog,
    changed: true,
    error: null,
    advanced,
    unsupportedRepeat: !repeatSupported(repeat)
  }
}

export function journalPath(day: string): string {
  return `journal/${day}.md`
}

export function appendJournalTask(existing: string | null, text: string, due: string, id: string): string {
  const line = `- [ ] ${text} <!-- deskmark: id=${id}; due=${due} -->`
  if (existing == null || existing.length === 0) {
    return `---\ntitle: ${due}\ndeskmark:\n  kind: note\n---\n\n${line}\n`
  }
  const separator = existing.endsWith('\n') ? '' : '\n'
  return `${existing}${separator}${line}\n`
}

function unchanged(markdown: string, error: string): EditResult {
  return { markdown, changed: false, error, advanced: false, unsupportedRepeat: false }
}

function splitLines(markdown: string): Lines {
  const newline = markdown.includes('\r\n') ? '\r\n' : '\n'
  const endsWithNewline = markdown.endsWith(newline)
  const lines = markdown.length === 0 ? [] : markdown.split(newline)
  if (endsWithNewline) lines.pop()
  return { lines, newline }
}

function joinLines(lines: string[], newline: string): string {
  if (lines.length === 0) return ''
  return `${lines.join(newline)}${newline}`
}

function readFrontMatter(lines: string[]): { title: string | null, fields: FieldEntry[], error: string | null, end: number } {
  if (lines[0] !== '---') return { title: null, fields: [], error: null, end: -1 }
  let end = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      end = index
      break
    }
  }
  if (end === -1) return { title: null, fields: [], error: 'unclosed', end: -1 }
  const body = lines.slice(1, end)
  let title: string | null = null
  const fields: FieldEntry[] = []
  for (let index = 0; index < body.length; index += 1) {
    const line = body[index]
    const top = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line)
    if (!top) continue
    if (top[1] === 'title' && title == null) title = unquote(top[2])
    if (top[1] !== 'deskmark') continue
    const raw: string[] = []
    index += 1
    while (index < body.length && /^\s/.test(body[index])) {
      raw.push(body[index])
      index += 1
    }
    index -= 1
    fields.push(...parseIndented(raw))
  }
  return { title, fields, error: null, end }
}

function parseIndented(rawLines: string[]): FieldEntry[] {
  const fields: FieldEntry[] = []
  for (let index = 0; index < rawLines.length; index += 1) {
    const match = /^(\s*)([^:\s]+):\s*(.*)$/.exec(rawLines[index])
    if (!match) continue
    const raw = [rawLines[index]]
    const indent = match[1].length
    while (index + 1 < rawLines.length && leadingSpaces(rawLines[index + 1]) > indent) {
      index += 1
      raw.push(rawLines[index])
    }
    fields.push({ key: match[2], value: match[3].trim(), raw })
  }
  return fields
}

function leadingSpaces(line: string): number {
  return /^\s*/.exec(line)?.[0].length ?? 0
}

function parseFields(entries: FieldEntry[]): NoteFields {
  const map = new Map(entries.map(entry => [entry.key, entry]))
  const issues: string[] = []
  const kindValue = map.get('kind')?.value
  const statusValue = map.get('status')?.value
  const priorityValue = map.get('priority')?.value
  const repeat = map.get('repeat')?.value ?? 'none'
  if (kindValue && kindValue !== 'note' && kindValue !== 'todo') issues.push('kind')
  if (statusValue && statusValue !== 'open' && statusValue !== 'done') issues.push('status')
  if (priorityValue && priorityValue !== 'low' && priorityValue !== 'normal' && priorityValue !== 'high') issues.push('priority')
  const unknown = entries.filter(entry => !KNOWN_KEYS.includes(entry.key))
  return {
    id: emptyToNull(map.get('id')?.value),
    kind: kindValue === 'todo' ? 'todo' : 'note',
    status: statusValue === 'done' ? 'done' : 'open',
    due: emptyToNull(map.get('due')?.value),
    remind: emptyToNull(map.get('remind')?.value),
    priority: priorityValue === 'low' || priorityValue === 'high' ? priorityValue : 'normal',
    repeat,
    repeatSupported: repeatSupported(repeat),
    completed: emptyToNull(map.get('completed')?.value),
    unknown,
    issues
  }
}

function parseTasks(lines: string[], path: string): TaskItem[] {
  const tasks: TaskItem[] = []
  let fence: string | null = null
  lines.forEach((line, index) => {
    const fenceMatch = /^(`{3,}|~{3,})/.exec(line.trim())
    if (fence) {
      if (line.trim().startsWith(fence)) fence = null
      return
    }
    if (fenceMatch) {
      fence = fenceMatch[1]
      return
    }
    const task = parseTaskLine(line, index + 1, path)
    if (task) tasks.push(task)
  })
  return tasks
}

function parseTaskLine(line: string, lineNumber: number, path: string): TaskItem | null {
  const match = /^(\s*)([-*+])\s+\[([ xX])\]\s?(.*)$/.exec(line)
  if (!match) return null
  const comment = /^(.*?)\s*<!--\s*deskmark:(.*?)-->\s*$/.exec(match[4])
  const text = (comment ? comment[1] : match[4]).trim()
  const entries = comment ? parseComment(comment[2]) : []
  const map = new Map(entries.map(entry => [entry.key, entry.value]))
  const priority = map.get('priority')
  const repeat = map.get('repeat') ?? 'none'
  return {
    line: lineNumber,
    indent: match[1],
    marker: match[2],
    checked: match[3].toLowerCase() === 'x',
    text,
    id: emptyToNull(map.get('id')),
    due: emptyToNull(map.get('due')),
    remind: emptyToNull(map.get('remind')),
    priority: priority === 'low' || priority === 'high' ? priority : 'normal',
    repeat,
    repeatSupported: repeatSupported(repeat),
    completed: emptyToNull(map.get('completed')),
    temporaryKey: temporaryKey(path, text, lineNumber),
    unknown: entries.filter(entry => !KNOWN_KEYS.includes(entry.key))
  }
}

function parseComment(body: string): FieldEntry[] {
  const entries: FieldEntry[] = []
  for (const part of body.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) {
      entries.push({ key: trimmed, value: '', raw: [] })
      continue
    }
    entries.push({ key: trimmed.slice(0, eq).trim(), value: trimmed.slice(eq + 1).trim(), raw: [] })
  }
  return entries
}

function applyInlinePatch(task: TaskItem, patch: InlinePatch, allocateId: () => string): TaskItem {
  const next: TaskItem = {
    ...task,
    text: patch.text ?? task.text,
    checked: patch.checked ?? task.checked,
    due: patch.due === undefined ? task.due : patch.due,
    remind: patch.remind === undefined ? task.remind : patch.remind,
    priority: patch.priority === undefined || patch.priority == null ? task.priority : patch.priority,
    repeat: patch.repeat === undefined || patch.repeat == null ? task.repeat : patch.repeat,
    completed: patch.completed === undefined ? task.completed : patch.completed,
    id: patch.id ?? task.id,
    unknown: task.unknown.map(entry => ({ ...entry }))
  }
  next.repeatSupported = repeatSupported(next.repeat)
  const needsId = next.id == null && hasPersistentMeta(next)
  if (needsId) next.id = allocateId()
  return next
}

function hasPersistentMeta(task: TaskItem): boolean {
  return Boolean(task.due || task.remind || task.completed || (task.priority !== 'normal') || (task.repeat !== 'none' && task.repeat !== ''))
}

function renderTaskLine(task: TaskItem): string {
  const box = task.checked ? 'x' : ' '
  const comment = renderComment(task)
  const suffix = comment ? ` ${comment}` : ''
  return `${task.indent}${task.marker} [${box}] ${task.text}${suffix}`
}

function renderComment(task: TaskItem): string | null {
  const pairs: Array<[string, string]> = []
  if (task.id) pairs.push(['id', task.id])
  if (task.due) pairs.push(['due', task.due])
  if (task.remind) pairs.push(['remind', task.remind])
  if (task.priority !== 'normal') pairs.push(['priority', task.priority])
  if (task.repeat && task.repeat !== 'none') pairs.push(['repeat', task.repeat])
  if (task.completed) pairs.push(['completed', task.completed])
  for (const entry of task.unknown) pairs.push([entry.key, entry.value])
  if (pairs.length === 0) return null
  return `<!-- deskmark: ${pairs.map(([key, value]) => `${key}=${value}`).join('; ')} -->`
}

function rewriteFrontMatter(markdown: string, fields: NoteFields, error: string | null): string {
  if (error === 'unclosed') return markdown
  const { lines, newline } = splitLines(markdown)
  const block = renderDeskmarkBlock(fields)
  if (lines[0] !== '---') {
    return joinLines(['---', ...block, '---', '', ...lines], newline)
  }
  let end = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      end = index
      break
    }
  }
  if (end === -1) return markdown
  const kept: string[] = []
  let skipping = false
  for (const line of lines.slice(1, end)) {
    if (/^deskmark:\s*$/.test(line)) {
      skipping = true
      continue
    }
    if (skipping && /^\s/.test(line)) continue
    skipping = false
    kept.push(line)
  }
  return joinLines([...lines.slice(0, 1), ...kept, ...block, ...lines.slice(end)], newline)
}

function renderDeskmarkBlock(fields: NoteFields): string[] {
  const lines = ['deskmark:']
  const push = (key: string, value: string | null) => {
    if (value) lines.push(`  ${key}: ${value}`)
  }
  push('id', fields.id)
  if (fields.kind === 'todo') lines.push('  kind: todo')
  if (fields.status === 'done') lines.push('  status: done')
  push('due', fields.due)
  push('remind', fields.remind)
  if (fields.priority !== 'normal') lines.push(`  priority: ${fields.priority}`)
  if (fields.repeat && fields.repeat !== 'none') lines.push(`  repeat: ${fields.repeat}`)
  push('completed', fields.completed)
  for (const entry of fields.unknown) lines.push(...(entry.raw.length ? entry.raw : [`  ${entry.key}: ${entry.value}`]))
  return lines
}

function appendCompletion(markdown: string, stamp: string): string {
  const { lines, newline } = splitLines(markdown)
  const heading = '## 完成记录'
  const entry = `- ${stamp}`
  const headingIndex = lines.findIndex(line => line.trim() === heading)
  if (headingIndex === -1) {
    const body = lines.join(newline).replace(/\s*$/, '')
    return `${body}${newline}${newline}${heading}${newline}${newline}${entry}${newline}`
  }
  let insertAt = lines.length
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^#{1,6}\s/.test(lines[index])) {
      insertAt = index
      break
    }
  }
  lines.splice(insertAt, 0, entry)
  return joinLines(lines, newline)
}

function emptyToNull(value: string | undefined): string | null {
  if (!value) return null
  return value
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function isAllDay(due: string | null): boolean {
  return Boolean(due && parseDue(due)?.time == null)
}
