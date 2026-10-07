import { readFile } from 'node:fs/promises'
import type { ExtractRules } from '../../deskmark-core/src/index.ts'
import type { PreparedNote } from './prepare.ts'
import { prepareVaultFile } from './prepare.ts'
import { listTextFiles } from './vault.ts'

// One huge text file must not hold up the rest of the folder.
export const MAX_TEXT_BYTES = 2 * 1024 * 1024
const NOTE_BATCH = 8

export interface IndexRequest {
  root: string
  extensions: string[]
  rules: ExtractRules
  times: Array<[string, number]>
  force: boolean
}

export type IndexEvent =
  | { type: 'progress', visited: number }
  | { type: 'notes', visited: number, notes: PreparedNote[] }
  | { type: 'done', visited: number, paths: string[] }

// Walk, read and parse away from the caller. `emit` may wait so a slow writer
// can hold the walk instead of queuing every note in memory.
export async function indexTextFiles(
  request: IndexRequest,
  emit: (event: IndexEvent) => void | Promise<void>,
  shouldStop: () => boolean
): Promise<void> {
  const times = new Map(request.times)
  const paths: string[] = []
  const batch: PreparedNote[] = []
  let visited = 0
  const flush = async(): Promise<void> => {
    if (!batch.length || shouldStop()) return
    const notes = batch.splice(0, batch.length)
    await emit({ type: 'notes', visited, notes })
  }
  await listTextFiles(request.root, request.extensions, shouldStop, async(file) => {
    paths.push(file.path)
    if (file.size > MAX_TEXT_BYTES) return
    if (!request.force && times.get(file.path) === file.mtimeMs) return
    let content: string
    try {
      content = await readFile(file.fullPath, 'utf8')
    } catch {
      return
    }
    if (shouldStop()) return
    batch.push(prepareVaultFile({
      path: file.path,
      content,
      mtimeMs: file.mtimeMs
    }, request.rules))
    if (batch.length >= NOTE_BATCH) await flush()
  }, (count) => {
    visited = count
    void emit({ type: 'progress', visited })
  })
  if (shouldStop()) return
  await flush()
  if (shouldStop()) return
  await emit({ type: 'done', visited, paths })
}
