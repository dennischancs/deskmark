import { app, webContents } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  answerPluginCall,
  noteInsideVault,
  readManifest,
  type NoteSnapshot,
  type PluginManifest
} from '../../../../deskmark-plugin/src/index.ts'

let snapshot: NoteSnapshot | null = null
let manifest: PluginManifest | null = null
let entryUrl = ''

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
  if (!dir) return null
  try {
    manifest = readManifest(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')))
  } catch {
    manifest = null
    entryUrl = ''
    return null
  }
  entryUrl = pathToFileURL(join(dir, manifest.entry)).href
  return { src: entryUrl, preload: pluginPreloadPath(), manifest }
}

export function rememberPluginNote(next: NoteSnapshot | null): void {
  if (!next || !noteInsideVault(next.path)) snapshot = null
  else snapshot = next
  if (!entryUrl) return
  for (const contents of webContents.getAllWebContents()) {
    if (contents.getURL() === entryUrl) contents.send('mt::deskmark::plugin-refresh')
  }
}

export function registerPluginGuestGuard(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      if (!entryUrl || params.src !== entryUrl) {
        event.preventDefault()
        return
      }
      webPreferences.nodeIntegration = false
      webPreferences.nodeIntegrationInSubFrames = false
      webPreferences.contextIsolation = true
      webPreferences.sandbox = true
      webPreferences.webSecurity = true
      webPreferences.preload = pluginPreloadPath()
    })
  })
}

export function handlePluginCall(call: { id?: string, method?: string, path?: string }): { id: string, ok: boolean, result?: unknown, error?: string } {
  if (!manifest) return { id: call.id || '', ok: false, error: '这个小功能没能打开' }
  return answerPluginCall({
    manifest,
    call: { id: call.id || '', method: call.method || '', path: call.path },
    snapshot,
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
