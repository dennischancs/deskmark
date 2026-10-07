import { createHash } from 'node:crypto'
import { agendaForIndex, parseNote, type ExtractRules } from '../../deskmark-core/src/index.ts'
import type { VaultFile } from './database.ts'

export interface PreparedTask {
  taskKey: string
  line: number | null
  text: string
  status: 'open' | 'done'
  due: string | null
  remindAt: string | null
  priority: string
  repeat: string
  completedAt: string | null
  raw: string
  source: 'inline' | 'note'
}

export interface PreparedNote {
  path: string
  mtimeMs: number
  contentHash: string
  noteId: string
  kind: string
  title: string | null
  parseError: string | null
  // True only when parsing threw. A front-matter warning still indexes the tasks.
  failed: boolean
  tasks: PreparedTask[]
}

export function prepareVaultFile(file: VaultFile, rules: ExtractRules): PreparedNote {
  const contentHash = hashText(file.content)
  try {
    const parsed = parseNote(file.content, file.path)
    const items = agendaForIndex(file.path, file.content, rules, parsed)
    const seen = new Set<string>()
    const tasks: PreparedTask[] = []
    for (const item of items) {
      let key = item.id ?? item.temporaryKey
      while (seen.has(key)) key = `${key}#${item.line ?? 'note'}`
      seen.add(key)
      tasks.push({
        taskKey: key,
        line: item.line,
        text: item.text,
        status: item.done ? 'done' : 'open',
        due: item.due,
        remindAt: item.remind,
        priority: item.priority,
        repeat: item.repeat,
        completedAt: item.done ? completedFrom(file.content, item.line) : null,
        raw: rawLine(file.content, item.line),
        source: item.source
      })
    }
    return {
      path: file.path,
      mtimeMs: file.mtimeMs,
      contentHash,
      noteId: parsed.fields.id ?? hashText(file.path),
      kind: parsed.fields.kind,
      title: parsed.title,
      parseError: parsed.frontMatterError,
      failed: false,
      tasks
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      path: file.path,
      mtimeMs: file.mtimeMs,
      contentHash,
      noteId: hashText(file.path),
      kind: 'note',
      title: null,
      parseError: message,
      failed: true,
      tasks: []
    }
  }
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function rawLine(content: string, line: number | null): string {
  if (line == null) return ''
  return content.split(/\r?\n/)[line - 1] ?? ''
}

function completedFrom(content: string, line: number | null): string | null {
  const raw = rawLine(content, line)
  const match = /completed=([^;]+)/.exec(raw)
  return match ? match[1].trim() : null
}
