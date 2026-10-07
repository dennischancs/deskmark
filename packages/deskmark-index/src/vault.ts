import { readdirSync, readFileSync, statSync } from 'node:fs'
import { opendir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { compareAgenda, smartList, type SmartList } from '../../deskmark-core/src/index.ts'
import type { TaskRow, VaultFile } from './database.ts'

const SKIP = new Set(['.deskmark', '.git', 'node_modules'])

export function matchesExtension(name: string, extensions: readonly string[]): boolean {
  const lower = name.toLowerCase()
  return extensions.some(ext => ext.length > 0 && lower.endsWith(`.${ext}`))
}

export function collectVaultFiles(root: string, extensions: readonly string[] = ['md']): VaultFile[] {
  const files: VaultFile[] = []
  const visit = (directory: string): void => {
    let entries: ReturnType<typeof readdirSync>
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue
      const fullPath = join(directory, entry.name)
      if (entry.isDirectory()) {
        visit(fullPath)
        continue
      }
      if (!entry.isFile() || entry.isSymbolicLink() || !matchesExtension(entry.name, extensions)) continue
      const stat = statSync(fullPath)
      files.push({
        path: relative(root, fullPath).split('\\').join('/'),
        content: readFileSync(fullPath, 'utf8'),
        mtimeMs: stat.mtimeMs
      })
    }
  }
  visit(root)
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

export interface ListedFile {
  path: string
  fullPath: string
  mtimeMs: number
  size: number
}

// A single readdir of a directory with a hundred thousand names allocates
// the whole list before anything else can run. opendir hands names over in
// small groups, and the pause lets a stop request land.
const ENTRY_TURN = 250

export async function listTextFiles(
  root: string,
  extensions: readonly string[],
  shouldStop: () => boolean,
  onFile: (file: ListedFile) => Promise<void> | void,
  onProgress?: (visited: number) => void
): Promise<number> {
  const queue = [root]
  let visited = 0
  let seen = 0
  while (queue.length > 0) {
    if (shouldStop()) return seen
    const directory = queue.pop() as string
    let dir: Awaited<ReturnType<typeof opendir>>
    try {
      dir = await opendir(directory)
    } catch {
      continue
    }
    let stepped = 0
    try {
      for await (const entry of dir) {
        visited += 1
        if (++stepped % ENTRY_TURN === 0) {
          onProgress?.(visited)
          await new Promise<void>(resolve => setImmediate(resolve))
        }
        if (shouldStop()) return seen
        if (SKIP.has(entry.name) || entry.isSymbolicLink()) continue
        const fullPath = join(directory, entry.name)
        if (entry.isDirectory()) {
          queue.push(fullPath)
          continue
        }
        if (!entry.isFile() || !matchesExtension(entry.name, extensions)) continue
        let info: Awaited<ReturnType<typeof stat>>
        try {
          info = await stat(fullPath)
        } catch {
          continue
        }
        seen += 1
        await onFile({
          path: relative(root, fullPath).split('\\').join('/'),
          fullPath,
          mtimeMs: info.mtimeMs,
          size: info.size
        })
      }
    } finally {
      await dir.close().catch(() => {})
    }
  }
  onProgress?.(visited)
  return seen
}

export function groupTasks(tasks: TaskRow[], now: Date, timeZone: string): Record<SmartList, TaskRow[]> {
  const groups: Record<SmartList, TaskRow[]> = {
    inbox: [],
    today: [],
    upcoming: [],
    overdue: [],
    done: []
  }
  for (const task of tasks) {
    const list = smartList({ done: task.status === 'done', due: task.due }, now, timeZone)
    groups[list].push(task)
  }
  for (const list of Object.values(groups)) {
    list.sort((left, right) => compareAgenda(left, right))
  }
  return groups
}
