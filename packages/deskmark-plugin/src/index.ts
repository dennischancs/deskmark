export const API_MAJOR = 1

export const PERMISSIONS = [
  'notes.read',
  'notes.write',
  'tasks.read',
  'tasks.write',
  'ui.panel',
  'ui.command',
  'settings'
] as const

export type Permission = (typeof PERMISSIONS)[number]

export interface PluginManifest {
  id: string
  name: string
  api: number
  entry: string
  permissions: string[]
}

export interface PluginCommand {
  id: string
  title: string
}

export interface PluginView {
  id: string
  title: string
}

export interface HostContribution {
  id: string
  title: string
  kind: 'command' | 'view' | 'settings'
  builtin: boolean
}

export class PluginError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PluginError'
  }
}

export function readManifest(raw: unknown): PluginManifest {
  if (!raw || typeof raw !== 'object') throw new PluginError('清单不是对象')
  const value = raw as Record<string, unknown>
  if (typeof value.id !== 'string' || !/^[a-z0-9-]+$/.test(value.id)) {
    throw new PluginError('插件编号无效')
  }
  if (typeof value.name !== 'string' || !value.name.trim()) throw new PluginError('插件没有名称')
  if (value.api !== API_MAJOR) throw new PluginError(`这个插件需要第 ${String(value.api)} 版接口，当前是第 ${API_MAJOR} 版`)
  if (typeof value.entry !== 'string' || !value.entry.endsWith('.html') || value.entry.includes('..') || value.entry.startsWith('/') || value.entry.includes('\\')) {
    throw new PluginError('入口必须是插件目录里的页面')
  }
  if (!Array.isArray(value.permissions) || value.permissions.some(item => typeof item !== 'string' || !PERMISSIONS.includes(item as Permission))) {
    throw new PluginError('权限无效')
  }
  return {
    id: value.id,
    name: value.name,
    api: value.api,
    entry: value.entry,
    permissions: [...value.permissions]
  }
}

export function inspectPlugin(raw: string): { ok: true, manifest: PluginManifest } | { ok: false, error: string } {
  try {
    return { ok: true, manifest: readManifest(JSON.parse(raw)) }
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, error: '清单不是对象' }
    return { ok: false, error: error instanceof Error ? error.message : '这个小功能没能打开' }
  }
}

export function assertPermission(manifest: PluginManifest, permission: Permission): void {
  if (!manifest.permissions.includes(permission)) {
    throw new PluginError('这个小功能没有得到相应允许')
  }
}

export interface BridgeRequest {
  id: string
  method: string
  path?: string
  markdown?: string
}

export interface BridgeResponse {
  id: string
  ok: boolean
  result?: unknown
  error?: string
}

const METHODS: Record<string, Permission> = {
  'notes.read': 'notes.read',
  'notes.write': 'notes.write',
  'tasks.read': 'tasks.read',
  'tasks.write': 'tasks.write',
  'ui.command': 'ui.command',
  'ui.panel': 'ui.panel',
  'settings.read': 'settings'
}

export function authorize(manifest: PluginManifest, method: string): Permission {
  const permission = METHODS[method]
  if (!permission) throw new PluginError('没有这个操作')
  assertPermission(manifest, permission)
  return permission
}

export function noteInsideVault(notePath: string): boolean {
  const normalized = notePath.split('\\').join('/').replace(/^\.\//, '')
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return false
  return !normalized.split('/').includes('..')
}

export interface LoadedPlugin {
  manifest: PluginManifest
  commands: PluginCommand[]
  views: PluginView[]
  settings: PluginCommand[]
}

export class PluginHost {
  readonly builtins: HostContribution[] = []
  readonly plugins = new Map<string, LoadedPlugin>()

  registerBuiltin(contribution: HostContribution): void {
    if (!contribution.builtin) throw new PluginError('内置功能必须标明来源')
    this.builtins.push(contribution)
  }

  load(manifest: PluginManifest, contributions: { commands?: PluginCommand[], views?: PluginView[], settings?: PluginCommand[] } = {}): LoadedPlugin {
    if (this.plugins.has(manifest.id)) throw new PluginError('这个小功能已经打开')
    const commands = contributions.commands ?? []
    const views = contributions.views ?? []
    const settings = contributions.settings ?? []
    if (commands.length && !manifest.permissions.includes('ui.command')) {
      throw new PluginError('这个小功能没有得到相应允许')
    }
    if (views.length && !manifest.permissions.includes('ui.panel')) {
      throw new PluginError('这个小功能没有得到相应允许')
    }
    if (settings.length && !manifest.permissions.includes('settings')) {
      throw new PluginError('这个小功能没有得到相应允许')
    }
    const loaded = { manifest, commands, views, settings }
    this.plugins.set(manifest.id, loaded)
    return loaded
  }

  unload(id: string): void {
    this.plugins.delete(id)
  }

  commands(): HostContribution[] {
    const extra: HostContribution[] = []
    for (const plugin of this.plugins.values()) {
      for (const command of plugin.commands) {
        extra.push({ id: `${plugin.manifest.id}:${command.id}`, title: command.title, kind: 'command', builtin: false })
      }
    }
    return [...this.builtins.filter(item => item.kind === 'command'), ...extra]
  }

  views(): HostContribution[] {
    const extra: HostContribution[] = []
    for (const plugin of this.plugins.values()) {
      for (const view of plugin.views) {
        extra.push({ id: `${plugin.manifest.id}:${view.id}`, title: view.title, kind: 'view', builtin: false })
      }
    }
    return [...this.builtins.filter(item => item.kind === 'view'), ...extra]
  }

  settings(): HostContribution[] {
    const extra: HostContribution[] = []
    for (const plugin of this.plugins.values()) {
      for (const page of plugin.settings) {
        extra.push({ id: `${plugin.manifest.id}:${page.id}`, title: page.title, kind: 'settings', builtin: false })
      }
    }
    return [...this.builtins.filter(item => item.kind === 'settings'), ...extra]
  }
}

export function createDeadline(timeoutMs: number, now = Date.now()): { expired: () => boolean, assert: () => void } {
  const end = now + timeoutMs
  return {
    expired: () => Date.now() > end,
    assert: () => {
      if (Date.now() > end) throw new PluginError('这个小功能没有及时完成')
    }
  }
}

export interface PluginCall {
  id: string
  method: string
  path?: string
}

export interface NoteSnapshot {
  vault: string
  path: string
  markdown: string
}

export interface PluginTaskView {
  text: string
  path: string
  line: number | null
  due: string | null
  done: boolean
}

export interface PluginSettingsView {
  calendar: boolean
  tasks: boolean
  reminders: boolean
  reminderSeconds: number
  captureShortcut: string
  wordCount: boolean
  extensions: string
  taskLine: boolean
  commentMeta: boolean
  frontMatter: boolean
  dateInText: boolean
  extraPrefixes: string
}

const DEFAULT_EXTENSIONS = 'markdown,mdown,mkdn,md,mkd,mdwn,mdtxt,mdtext,mdx,text,txt'
const DEFAULT_CAPTURE = 'CommandOrControl+Alt+N'

function flag(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key]
  return typeof value === 'boolean' ? value : fallback
}

function text(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : fallback
}

function reminderSeconds(value: unknown): number {
  const seconds = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(seconds)) return 30
  return Math.min(600, Math.max(1, Math.round(seconds)))
}

export function readPluginSettings(source: object | null | undefined): PluginSettingsView {
  const raw = (source ?? {}) as Record<string, unknown>
  return {
    calendar: flag(raw, 'deskmarkCalendar', true),
    tasks: flag(raw, 'deskmarkTasks', true),
    reminders: flag(raw, 'deskmarkReminders', true),
    reminderSeconds: reminderSeconds(raw.deskmarkReminderSeconds),
    captureShortcut: text(raw, 'deskmarkCaptureAccelerator', DEFAULT_CAPTURE),
    wordCount: flag(raw, 'deskmarkWordCount', true),
    extensions: text(raw, 'deskmarkScanExtensions', DEFAULT_EXTENSIONS),
    taskLine: flag(raw, 'deskmarkRuleTaskLine', true),
    commentMeta: flag(raw, 'deskmarkRuleComment', true),
    frontMatter: flag(raw, 'deskmarkRuleFrontMatter', true),
    dateInText: flag(raw, 'deskmarkRuleDateInText', false),
    extraPrefixes: text(raw, 'deskmarkExtraPrefixes', '')
  }
}

export function answerPluginCall(input: {
  manifest: PluginManifest
  call: PluginCall
  snapshot: NoteSnapshot | null
  readVaultFile: (relativePath: string) => string | null
  tasks?: PluginTaskView[]
  settings?: PluginSettingsView | null
}): { id: string, ok: boolean, result?: unknown, error?: string } {
  const id = input.call.id || ''
  if (!input.call.id || !input.call.method) {
    return { id, ok: false, error: '没有这个操作' }
  }
  try {
    const permission = authorize(input.manifest, input.call.method)
    if (permission === 'tasks.read') {
      const tasks = (input.tasks ?? []).filter(task => noteInsideVault(task.path))
      return { id, ok: true, result: { tasks } }
    }
    if (permission === 'notes.write' || permission === 'tasks.write') {
      return { id, ok: false, error: '这个小功能还不能写入' }
    }
    if (permission === 'settings') {
      if (!input.settings) return { id, ok: false, error: '这个小功能还不能读取设置' }
      return { id, ok: true, result: { settings: input.settings } }
    }
    if (permission !== 'notes.read') {
      return { id, ok: true, result: { accepted: true } }
    }
    const requested = input.call.path || input.snapshot?.path || ''
    if (!noteInsideVault(requested)) throw new PluginError('这个小功能没有得到相应允许')
    if (input.snapshot && input.snapshot.path === requested) {
      return { id, ok: true, result: { path: requested, markdown: input.snapshot.markdown } }
    }
    const markdown = input.readVaultFile(requested)
    if (markdown == null) throw new PluginError('这个小功能没有得到相应允许')
    return { id, ok: true, result: { path: requested, markdown } }
  } catch (error) {
    return { id, ok: false, error: error instanceof Error ? error.message : '这个小功能没能打开' }
  }
}
