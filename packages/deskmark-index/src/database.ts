import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DEFAULT_EXTRACT_RULES, type ExtractRules } from '../../deskmark-core/src/index.ts'
import { IndexLock } from './lock.ts'
import { prepareVaultFile, type PreparedNote } from './prepare.ts'

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
    // The index is rebuilt from the notes, so losing the last commit on a
    // power cut is acceptable. FULL would flush every file and stall a folder
    // that holds thousands of text files.
    this.db.exec('PRAGMA synchronous = NORMAL')
    this.migrate()
  }

  close(): void {
    this.db?.close()
    this.db = null
    this.lock.release()
  }

  rebuild(files: VaultFile[], rules: ExtractRules = DEFAULT_EXTRACT_RULES): RebuildReport {
    const errors: string[] = []
    const sorted = [...files].sort((left, right) => left.path.localeCompare(right.path))
    this.transaction(() => {
      this.sql().exec('DELETE FROM tasks')
      this.sql().exec('DELETE FROM notes')
      for (const file of sorted) {
        const error = this.insertFile(file, rules)
        if (error) errors.push(`${file.path}: ${error}`)
      }
    })
    return { notes: this.count('notes'), tasks: this.count('tasks'), errors }
  }

  upsertFile(file: VaultFile, rules: ExtractRules = DEFAULT_EXTRACT_RULES): string | null {
    let error: string | null = null
    this.transaction(() => {
      error = this.insertFile(file, rules)
    })
    return error
  }

  writePrepared(notes: readonly PreparedNote[]): void {
    if (!notes.length) return
    this.transaction(() => {
      for (const note of notes) this.insertPrepared(note)
    })
  }

  removeFile(path: string): void {
    this.transaction(() => {
      this.deletePath(path)
    })
  }

  removeFiles(paths: readonly string[]): void {
    if (!paths.length) return
    this.transaction(() => {
      for (const path of paths) this.deletePath(path)
    })
  }

  noteTimes(): Map<string, number> {
    const rows = this.sql().prepare('SELECT path, mtime_ms AS mtimeMs FROM notes').all() as { path: string, mtimeMs: number }[]
    return new Map(rows.map(row => [row.path, row.mtimeMs]))
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

  private insertFile(file: VaultFile, rules: ExtractRules): string | null {
    const prepared = prepareVaultFile(file, rules)
    this.insertPrepared(prepared)
    return prepared.failed ? prepared.parseError : null
  }

  private insertPrepared(note: PreparedNote): void {
    this.deletePath(note.path)
    this.sql().prepare(`
      INSERT INTO notes (path, note_id, kind, title, mtime_ms, content_hash, parse_error)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      note.path,
      note.noteId,
      note.kind,
      note.title,
      note.mtimeMs,
      note.contentHash,
      note.parseError
    )
    const insertTask = this.sql().prepare(`
      INSERT INTO tasks (
        note_path, task_key, line, text, status, due, remind_at, priority, repeat,
        completed_at, raw, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const task of note.tasks) {
      insertTask.run(
        note.path,
        task.taskKey,
        task.line,
        task.text,
        task.status,
        task.due,
        task.remindAt,
        task.priority,
        task.repeat,
        task.completedAt,
        task.raw,
        task.source
      )
    }
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
