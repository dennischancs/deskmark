import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { agendaFromMarkdown, parseNote, type AgendaItem } from '../../deskmark-core/src/index.ts'
import { IndexLock } from './lock.ts'

export const SCHEMA_VERSION = 1

export interface VaultFile {
  path: string
  content: string
  mtimeMs: number
}

export interface NoteRow {
  path: string
  noteId: string
  kind: string
  title: string | null
  mtimeMs: number
  contentHash: string
  parseError: string | null
}

export interface TaskRow {
  taskKey: string
  notePath: string
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

export interface RebuildReport {
  notes: number
  tasks: number
  errors: string[]
}

export class VaultIndex {
  private db: DatabaseSync | null = null
  private readonly lock: IndexLock
  private readonly directory: string

  constructor(directory: string) {
    this.directory = directory
    this.lock = new IndexLock(join(directory, 'index.lock'))
  }

  open(): void {
    this.lock.acquire()
    mkdirSync(this.directory, { recursive: true })
    this.db = new DatabaseSync(join(this.directory, 'index.sqlite'))
    this.db.exec('PRAGMA journal_mode = WAL')
    this.migrate()
  }

  close(): void {
    this.db?.close()
    this.db = null
    this.lock.release()
  }

  rebuild(files: VaultFile[]): RebuildReport {
    const errors: string[] = []
    const sorted = [...files].sort((left, right) => left.path.localeCompare(right.path))
    this.transaction(() => {
      this.sql().exec('DELETE FROM tasks')
      this.sql().exec('DELETE FROM notes')
      for (const file of sorted) {
        const error = this.insertFile(file)
        if (error) errors.push(`${file.path}: ${error}`)
      }
    })
    return { notes: this.count('notes'), tasks: this.count('tasks'), errors }
  }

  upsertFile(file: VaultFile): string | null {
    let error: string | null = null
    this.transaction(() => {
      this.deletePath(file.path)
      error = this.insertFile(file)
    })
    return error
  }

  removeFile(path: string): void {
    this.transaction(() => {
      this.deletePath(path)
    })
  }

  notes(): NoteRow[] {
    return this.sql().prepare(`
      SELECT path, note_id AS noteId, kind, title, mtime_ms AS mtimeMs,
             content_hash AS contentHash, parse_error AS parseError
      FROM notes
      ORDER BY path
    `).all() as NoteRow[]
  }

  tasks(): TaskRow[] {
    return this.sql().prepare(`
      SELECT task_key AS taskKey, note_path AS notePath, line, text, status,
             due, remind_at AS remindAt, priority, repeat,
             completed_at AS completedAt, raw, source
      FROM tasks
      ORDER BY note_path, COALESCE(line, 0), task_key
    `).all() as TaskRow[]
  }

  private migrate(): void {
    this.sql().exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notes (
        path TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT,
        mtime_ms INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        parse_error TEXT
      );
      CREATE TABLE IF NOT EXISTS tasks (
        note_path TEXT NOT NULL,
        task_key TEXT NOT NULL,
        line INTEGER,
        text TEXT NOT NULL,
        status TEXT NOT NULL,
        due TEXT,
        remind_at TEXT,
        priority TEXT NOT NULL,
        repeat TEXT NOT NULL,
        completed_at TEXT,
        raw TEXT NOT NULL,
        source TEXT NOT NULL,
        PRIMARY KEY (note_path, task_key)
      );
    `)
    const current = this.sql().prepare('SELECT value FROM meta WHERE key = ?').get('schema') as { value: string } | undefined
    if (!current) {
      this.sql().prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('schema', String(SCHEMA_VERSION))
      return
    }
    if (current.value !== String(SCHEMA_VERSION)) {
      throw new Error(`索引版本 ${current.value} 无法读取，请删除后重建`)
    }
  }

  private insertFile(file: VaultFile): string | null {
    let parsed: ReturnType<typeof parseNote>
    let items: AgendaItem[]
    try {
      parsed = parseNote(file.content, file.path)
      items = agendaFromMarkdown(file.path, file.content)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.sql().prepare(`
        INSERT INTO notes (path, note_id, kind, title, mtime_ms, content_hash, parse_error)
        VALUES (?, ?, 'note', NULL, ?, ?, ?)
      `).run(file.path, hashText(file.path), file.mtimeMs, hashText(file.content), message)
      return message
    }
    const noteId = parsed.fields.id ?? hashText(file.path)
    this.sql().prepare(`
      INSERT INTO notes (path, note_id, kind, title, mtime_ms, content_hash, parse_error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      file.path,
      noteId,
      parsed.fields.kind,
      parsed.title,
      file.mtimeMs,
      hashText(file.content),
      parsed.frontMatterError
    )
    const insertTask = this.sql().prepare(`
      INSERT INTO tasks (
        note_path, task_key, line, text, status, due, remind_at, priority, repeat,
        completed_at, raw, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const seen = new Set<string>()
    for (const item of items) {
      let key = item.id ?? item.temporaryKey
      while (seen.has(key)) key = `${key}#${item.line ?? 'note'}`
      seen.add(key)
      insertTask.run(
        file.path,
        key,
        item.line,
        item.text,
        item.done ? 'done' : 'open',
        item.due,
        item.remind,
        item.priority,
        item.repeat,
        item.done ? completedFrom(file.content, item.line) : null,
        rawLine(file.content, item.line),
        item.source
      )
    }
    return null
  }

  private deletePath(path: string): void {
    this.sql().prepare('DELETE FROM tasks WHERE note_path = ?').run(path)
    this.sql().prepare('DELETE FROM notes WHERE path = ?').run(path)
  }

  private transaction(work: () => void): void {
    const db = this.sql()
    db.exec('BEGIN IMMEDIATE')
    try {
      work()
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  private count(table: 'notes' | 'tasks'): number {
    const row = this.sql().prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }
    return row.count
  }

  private sql(): DatabaseSync {
    if (!this.db) throw new Error('索引还没有打开')
    return this.db
  }
}

export function applyExternalChange(index: VaultIndex, file: VaultFile, dirty: ReadonlySet<string>): 'updated' | 'conflict' {
  if (dirty.has(file.path)) return 'conflict'
  index.upsertFile(file)
  return 'updated'
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
