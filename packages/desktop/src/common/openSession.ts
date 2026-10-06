import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import writeFileAtomic from 'write-file-atomic'
import { prefersSourceMode } from './sessionRules'

export const SESSION_VERSION = 1
export { prefersSourceMode, SNAPSHOT_INTERVAL_MS } from './sessionRules'

export interface SessionEntry {
  id: string
  path: string | null
  name: string
  cursor: unknown
  dirty: boolean
  sourceMode: boolean
}

export interface SessionDocument {
  version: number
  currentId: string | null
  files: SessionEntry[]
}

export interface SessionTabInput {
  id: string
  pathname?: string
  filename?: string
  markdown?: string
  isSaved?: boolean
  cursor?: unknown
}

export function tabsFromBufferState(state: unknown): { currentId: string | null, tabs: SessionTabInput[] } | null {
  if (!state || typeof state !== 'object') return null
  const record = state as { currentFileId?: unknown, tabs?: unknown, editor?: { currentFileId?: unknown, tabs?: unknown } }
  const editor = record.editor && typeof record.editor === 'object' ? record.editor : record
  if (!Array.isArray(editor.tabs)) return null
  const tabs = editor.tabs.filter((tab): tab is SessionTabInput => {
    return Boolean(tab) && typeof tab === 'object' && typeof (tab as SessionTabInput).id === 'string'
  })
  const currentId = typeof editor.currentFileId === 'string' ? editor.currentFileId : null
  return { currentId, tabs }
}

export function shouldPreserveOpenSession(previousFileCount: number, nextFileCount: number, allowEmptySession: boolean): boolean {
  return !allowEmptySession && previousFileCount > 0 && nextFileCount === 0
}

export class OpenSession {
  private readonly directory: string

  constructor(directory: string) {
    this.directory = directory
  }

  save(currentId: string | null, tabs: SessionTabInput[]): SessionDocument {
    mkdirSync(this.backupDirectory(), { recursive: true })
    const files = tabs.map((tab) => this.writeTab(tab))
    const keep = new Set(files.filter((file) => file.dirty).map((file) => file.id))
    for (const id of this.backupIds()) {
      if (!keep.has(id)) this.removeBackup(id)
    }
    const document: SessionDocument = { version: SESSION_VERSION, currentId, files }
    writeFileAtomic.sync(this.sessionFile(), JSON.stringify(document), 'utf8')
    return document
  }

  load(): { document: SessionDocument, drafts: Record<string, string> } {
    if (!existsSync(this.sessionFile())) {
      return { document: { version: SESSION_VERSION, currentId: null, files: [] }, drafts: {} }
    }
    const document = JSON.parse(readFileSync(this.sessionFile(), 'utf8')) as SessionDocument
    const drafts: Record<string, string> = {}
    for (const file of document.files) {
      if (!file.dirty) continue
      const backup = this.backupFile(file.id)
      if (existsSync(backup)) drafts[file.id] = readFileSync(backup, 'utf8')
    }
    return { document, drafts }
  }

  private writeTab(tab: SessionTabInput): SessionEntry {
    const name = tab.filename || fileName(tab.pathname) || '未命名'
    const dirty = tab.isSaved === false || !tab.pathname
    if (dirty) writeFileAtomic.sync(this.backupFile(tab.id), tab.markdown ?? '', 'utf8')
    else this.removeBackup(tab.id)
    return {
      id: tab.id,
      path: tab.pathname || null,
      name,
      cursor: tab.cursor ?? null,
      dirty,
      sourceMode: prefersSourceMode(name)
    }
  }

  private backupIds(): string[] {
    if (!existsSync(this.backupDirectory())) return []
    return readdirSync(this.backupDirectory())
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.slice(0, -3))
  }

  private removeBackup(id: string): void {
    rmSync(this.backupFile(id), { force: true })
  }

  private backupDirectory(): string {
    return join(this.directory, 'backup')
  }

  private backupFile(id: string): string {
    return join(this.backupDirectory(), `${id}.md`)
  }

  private sessionFile(): string {
    return join(this.directory, 'session.json')
  }
}

function fileName(pathname: string | undefined): string {
  if (!pathname) return ''
  const parts = pathname.split(/[/\\]/)
  return parts[parts.length - 1] ?? ''
}
