import { copyFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { BrowserWindow } from 'electron'
import type { ExtractRules } from '../../../../deskmark-core/src/index.ts'
import { normalizeExtensions } from '../../../../deskmark-core/src/extensions.ts'
import { groupTasks, indexTextFiles, VaultIndex, type IndexEvent } from '../../../../deskmark-index/src/index.ts'
import type { DeskmarkScanOptions, DeskmarkTaskGroups } from '@shared/types/ipc'

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
  stop: (() => void) | null
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
  open?.stop?.()
  open?.index.close()
  const index = new VaultIndex(join(root, '.deskmark'))
  index.open()
  open = {
    root,
    key: '',
    token: 0,
    running: false,
    dirty: false,
    seen: 0,
    index,
    options: DEFAULT_SCAN_OPTIONS,
    stop: null
  }
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

function applyIndexEvent(token: number, event: IndexEvent, known: Map<string, number>): void {
  const current = open
  if (!current || current.token !== token) return
  if (event.type === 'progress' || event.type === 'notes') {
    current.seen = event.visited
  }
  if (event.type === 'notes') {
    current.index.writePrepared(event.notes)
    current.dirty = true
  }
  if (event.type === 'done') {
    const live = new Set(event.paths)
    const missing = [...known.keys()].filter(path => !live.has(path))
    if (missing.length) {
      current.index.removeFiles(missing)
      current.dirty = true
    }
    current.seen = event.visited
    current.running = false
    current.stop = null
  }
}

// A packaged app keeps this file inside app.asar. Worker threads can only
// load a real path, so copy the single bundled script out once.
let workerCopy: string | null = null

function workerScript(): string | null {
  const bundled = join(__dirname, 'scanWorker.js')
  if (!existsSync(bundled)) return null
  if (!bundled.includes('app.asar')) return bundled
  if (workerCopy && existsSync(workerCopy)) return workerCopy
  workerCopy = join(tmpdir(), `deskmark-scan-worker-${process.pid}.js`)
  copyFileSync(bundled, workerCopy)
  return workerCopy
}

function startScan(token: number, root: string, options: DeskmarkScanOptions, force: boolean): void {
  const current = hold(root)
  const rules = rulesFrom(options)
  const extensions = normalizeExtensions(options.extensions)
  const times = current.index.noteTimes()
  const request = {
    root,
    extensions: extensions.length ? extensions : ['md'],
    rules,
    times: [...times.entries()],
    force
  }
  const script = workerScript()
  if (!script) {
    const stop = (): boolean => !open || open.token !== token
    current.stop = () => {
      current.token += 1
    }
    indexTextFiles(request, async(event) => {
      if (stop()) return
      applyIndexEvent(token, event, times)
      publish(event.type === 'done')
      if (event.type === 'done') onFinished?.()
      if (event.type === 'notes') await new Promise<void>(resolve => setImmediate(resolve))
    }, stop).catch(() => {
      if (!open || open.token !== token) return
      open.running = false
      publish(true)
    })
    return
  }
  const worker = new Worker(script, { workerData: request })
  let settled = false
  const finish = (): void => {
    if (settled) return
    settled = true
    if (open?.stop === stop) open.stop = null
  }
  const stop = (): void => {
    finish()
    worker.postMessage('stop')
    worker.terminate().catch(() => {})
  }
  current.stop = stop
  worker.on('message', (event: IndexEvent | { type: 'failed', message: string }) => {
    if (!open || open.token !== token) {
      if (event.type === 'notes') worker.postMessage('ack')
      return
    }
    if (event.type === 'failed') {
      open.running = false
      publish(true)
      finish()
      return
    }
    try {
      applyIndexEvent(token, event, times)
      publish(event.type === 'done')
      if (event.type === 'done') {
        onFinished?.()
        finish()
      }
    } catch {
      if (open && open.token === token) {
        open.running = false
        publish(true)
      }
    } finally {
      if (event.type === 'notes') worker.postMessage('ack')
    }
  })
  worker.on('error', () => {
    if (!open || open.token !== token) return
    open.running = false
    publish(true)
    finish()
  })
  worker.on('exit', () => {
    if (!open || open.token !== token || !open.running) return
    open.running = false
    publish(true)
    finish()
  })
}

export function ensureScan(root: string, options: DeskmarkScanOptions | null | undefined, now: Date, timeZone: string): DeskmarkTaskGroups {
  const current = hold(root)
  const chosen = options ?? current.options
  const key = optionsKey(chosen)
  if (current.key !== key) {
    const force = current.key !== ''
    current.stop?.()
    current.token += 1
    current.key = key
    current.running = true
    current.seen = 0
    current.dirty = false
    lastPublish = 0
    current.options = chosen
    const token = current.token
    startScan(token, root, chosen, force)
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
