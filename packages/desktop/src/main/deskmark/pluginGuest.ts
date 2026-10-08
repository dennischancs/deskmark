import { app, webContents, type WebPreferences } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { samePluginEntry } from './pluginEntry'
import {
  answerPluginCall,
  inspectPlugin,
  noteInsideVault,
  readPluginSettings,
  type NoteSnapshot,
  type PluginTaskView,
  type PluginManifest
} from '../../../../deskmark-plugin/src/index.ts'
import { readTaskGroups } from './tasks'

let snapshot: NoteSnapshot | null = null
let manifest: PluginManifest | null = null
let entryUrl = ''
let settingsSource: (() => object) | null = null

export function setPluginSettingsSource(source: () => object): void {
  settingsSource = source
}

export function samplePluginDirectory(): string | null {
  const candidates = [
    join(process.cwd(), 'plugins', 'sample-wordcount'),
    join(app.getAppPath(), '..', '..', 'plugins', 'sample-wordcount')
  ]
  return candidates.find(dir => existsSync(join(dir, 'manifest.json'))) ?? null
}

export function pluginPreloadPath(): string {
  return join(__dirname, '../preload/plugin.js')
}

export function loadSamplePlugin(): { src: string, preload: string, manifest: PluginManifest } | null {
  const dir = samplePluginDirectory()
  if (!dir) {
    manifest = null
    entryUrl = ''
    return null
  }
  return loadDirectory(dir, true)
}

export function loadUserPlugin(dir: string | null): { ok: true, active: false } | { ok: true, active: true, src: string, manifest: PluginManifest } | { ok: false, error: string } {
  const trimmed = dir?.trim() || ''
  if (!trimmed) {
    loadSamplePlugin()
    return { ok: true, active: false }
  }
  try {
    const loaded = loadDirectory(trimmed, false)
    if (!loaded) return { ok: false, error: '这个小功能没能打开' }
    return { ok: true, active: true, src: loaded.src, manifest: loaded.manifest }
  } catch (error) {
    loadSamplePlugin()
    const message = error instanceof Error ? error.message : '这个小功能没能打开'
    return { ok: false, error: /清单|插件|入口|权限|接口/.test(message) ? message : '这个小功能没能打开' }
  }
}

function loadDirectory(dir: string, builtin: boolean): { src: string, preload: string, manifest: PluginManifest } | null {
  let text = ''
  try {
    text = readFileSync(join(dir, 'manifest.json'), 'utf8')
  } catch (error) {
    if (builtin) {
      manifest = null
      entryUrl = ''
      return null
    }
    throw error
  }
  const inspected = inspectPlugin(text)
  if (!inspected.ok) {
    if (builtin) {
      manifest = null
      entryUrl = ''
      return null
    }
    throw new Error(inspected.error)
  }
  manifest = inspected.manifest
  entryUrl = pathToFileURL(join(dir, manifest.entry)).href
  return { src: entryUrl, preload: pluginPreloadPath(), manifest }
}

export function rememberPluginNote(next: NoteSnapshot | null): void {
  if (!next || !noteInsideVault(next.path)) snapshot = null
  else snapshot = next
  if (!entryUrl) return
  for (const contents of webContents.getAllWebContents()) {
    if (samePluginEntry(entryUrl, contents.getURL())) contents.send('mt::deskmark::plugin-refresh')
  }
}

export function retainPluginWebview(webPreferences: WebPreferences, params: { src?: string }): boolean {
  if (!samePluginEntry(entryUrl, params.src || '')) return false
  webPreferences.nodeIntegration = false
  webPreferences.nodeIntegrationInSubFrames = false
  webPreferences.contextIsolation = true
  webPreferences.sandbox = true
  webPreferences.webSecurity = true
  webPreferences.preload = pluginPreloadPath()
  return true
}

export function handlePluginCall(call: { id?: string, method?: string, path?: string }): { id: string, ok: boolean, result?: unknown, error?: string } {
  if (!manifest) return { id: call.id || '', ok: false, error: '这个小功能没能打开' }
  const tasks: PluginTaskView[] = []
  if (call.method === 'tasks.read' && snapshot) {
    try {
      const groups = readTaskGroups(snapshot.vault)
      for (const task of [groups.inbox, groups.today, groups.upcoming, groups.overdue, groups.done].flat()) {
        tasks.push({
          text: task.text,
          path: task.notePath,
          line: task.line,
          due: task.due,
          done: task.status === 'done'
        })
      }
    } catch {
      // A vault that cannot be scanned still answers the call with no tasks.
    }
  }
  return answerPluginCall({
    manifest,
    call: { id: call.id || '', method: call.method || '', path: call.path },
    snapshot,
    tasks,
    settings: currentPluginSettings(call.method),
    readVaultFile: (relative) => {
      if (!snapshot || !noteInsideVault(relative)) return null
      const root = resolve(snapshot.vault)
      const full = resolve(root, relative)
      const prefix = root.endsWith(sep) ? root : root + sep
      if (full !== root && !full.startsWith(prefix)) return null
      if (!existsSync(full)) return null
      return readFileSync(full, 'utf8')
    }
  })
}

function currentPluginSettings(method: string | undefined) {
  if (method !== 'settings.read' || !settingsSource) return null
  try {
    return readPluginSettings(settingsSource())
  } catch {
    return null
  }
}
