import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { compareAgenda, smartList, type SmartList } from '../../deskmark-core/src/index.ts'
import type { TaskRow, VaultFile } from './database.ts'

const SKIP = new Set(['.deskmark', '.git', 'node_modules'])

export function collectVaultFiles(root: string): VaultFile[] {
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
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
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
