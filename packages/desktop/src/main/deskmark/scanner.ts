import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import type { ExtractRules } from '../../../../deskmark-core/src/index.ts'
import { normalizeExtensions } from '../../../../deskmark-core/src/extensions.ts'
import { groupTasks, listTextFiles, VaultIndex } from '../../../../deskmark-index/src/index.ts'
import type { DeskmarkScanOptions, DeskmarkTaskGroups } from '@shared/types/ipc'

// A folder such as Downloads can hold well over a hundred thousand files.
// Reading all of them inside one request freezes the window, so the walk
// yields. Files larger than this are left out; one giant text file should
// not stall the rest of the index.
const MAX_TEXT_BYTES = 2 * 1024 * 1024
// The counter can move often. Reloading every task into the window cannot.
const PUBLISH_GAP_MS = 400

export const DEFAULT_SCAN_EXTENSIONS = 'markdown,mdown,mkdn,md,mkd,mdwn,mdtxt,mdtext,mdx,text,txt'

export const DEFAULT_SCAN_OPTIONS: DeskmarkScanOptions = {
  extensions: DEFAULT_SCAN_EXTENSIONS,
  taskLine: true,
  commentMeta: true,
  frontMatter: true,
  dateInText: false,
  extraPrefixes: ''
}

interface OpenScan {
  root: string
  key: string
  token: number
  running: boolean
  dirty: boolean
  seen: number
  index: VaultIndex
  options: DeskmarkScanOptions
}

let open: OpenScan | null = null
let lastPublish = 0
let onFinished: (() => void) | null = null

export function whenScanFinishes(fn: () => void): void {
  onFinished = fn
}

const rulesFrom = (options: DeskmarkScanOptions): ExtractRules => ({
  taskLine: options.taskLine !== false,
  commentMeta: options.commentMeta !== false,
  frontMatter: options.frontMatter !== false,
  dateInText: options.dateInText === true,
  extraPrefixes: options.extraPrefixes.split(/[,，]/).map(item => item.trim()).filter(item => item.length > 0)
})

const optionsKey = (options: DeskmarkScanOptions): string => JSON.stringify({
  extensions: normalizeExtensions(options.extensions).join(','),
  taskLine: options.taskLine !== false,
  commentMeta: options.commentMeta !== false,
  frontMatter: options.frontMatter !== false,
  dateInText: options.dateInText === true,
  extraPrefixes: rulesFrom(options).extraPrefixes.join('\n')
})

const hold = (root: string): OpenScan => {
  if (open && open.root === root) return open
  open?.index.close()
  const index = new VaultIndex(join(root, '.deskmark'))
  index.open()
  open = { root, key: '', token: 0, running: false, dirty: false, seen: 0, index, options: DEFAULT_SCAN_OPTIONS }
  return open
}

const publish = (force = false): void => {
  if (!open) return
  const now = Date.now()
  if (!force && now - lastPublish < PUBLISH_GAP_MS) return
  lastPublish = now
  const payload = { seen: open.seen, scanning: open.running }
  const changed = open.dirty
  open.dirty = false
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send('mt::deskmark-index-tick', { ...payload, changed })
  }
}

const snapshot = (root: string, now: Date, timeZone: string): DeskmarkTaskGroups => {
  const current = hold(root)
  const groups = groupTasks(current.index.tasks(), now, timeZone)
  return {
    ...groups,
    scanning: current.running,
    seen: current.seen
  }
}

async function runScan(token: number, root: string, options: DeskmarkScanOptions, force: boolean): Promise<void> {
  const current = hold(root)
  const rules = rulesFrom(options)
  const extensions = normalizeExtensions(options.extensions)
  const times = current.index.noteTimes()
  const seenPaths = new Set<string>()
  const stop = (): boolean => !open || open.token !== token
  try {
    await listTextFiles(root, extensions.length ? extensions : ['md'], stop, async(file) => {
      if (stop()) return
      seenPaths.add(file.path)
      current.seen += 1
      if (file.size > MAX_TEXT_BYTES) {
        publish()
        return
      }
      if (!force && times.get(file.path) === file.mtimeMs) {
        publish()
        return
      }
      try {
        const content = await readFile(file.fullPath, 'utf8')
        if (stop()) return
        current.index.upsertFile({ path: file.path, content, mtimeMs: file.mtimeMs }, rules)
        current.dirty = true
      } catch {
        return
      }
      publish()
      await new Promise<void>(resolve => setImmediate(resolve))
    })
  } catch {
    // A bad directory should not stop the editor.
  }
  if (stop()) return
  let removed = 0
  for (const path of times.keys()) {
    if (seenPaths.has(path)) continue
    current.index.removeFile(path)
    current.dirty = true
    removed += 1
    if (removed % 40 === 0) await new Promise<void>(resolve => setImmediate(resolve))
    if (stop()) return
  }
  if (stop()) return
  current.running = false
  publish(true)
  onFinished?.()
}

export function ensureScan(root: string, options: DeskmarkScanOptions | null | undefined, now: Date, timeZone: string): DeskmarkTaskGroups {
  const current = hold(root)
  const chosen = options ?? current.options
  const key = optionsKey(chosen)
  if (current.key !== key) {
    const force = current.key !== ''
    current.token += 1
    current.key = key
    current.running = true
    current.seen = 0
    current.dirty = false
    lastPublish = 0
    current.options = chosen
    const token = current.token
    runScan(token, root, chosen, force).catch(() => {})
  }
  return snapshot(root, now, timeZone)
}

export function rememberFile(root: string, notePath: string, markdown: string): void {
  const current = hold(root)
  const rules = rulesFrom(current.options)
  current.index.upsertFile({
    path: notePath.split('\\').join('/'),
    content: markdown,
    mtimeMs: Date.now()
  }, rules)
}

export function currentGroups(root: string, now: Date, timeZone: string): DeskmarkTaskGroups {
  return snapshot(root, now, timeZone)
}
