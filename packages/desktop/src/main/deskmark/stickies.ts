import { appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, Menu, Tray, nativeImage } from 'electron'
import type { WindowRect } from 'common/windowRect'
import {
  closeSticky,
  findSticky,
  normalizeNotePath,
  upsertSticky,
  type StickyRecord
} from 'common/stickyModel'
import { loadUiState, saveUiState } from 'common/stickyFile'
import { t } from '../i18n'
import EditorWindow from '../windows/editor'
import type WindowManager from '../app/windowManager'
import type Accessor from '../app/accessor'

const DEFAULT_BOUNDS = { x: 80, y: 80, width: 360, height: 320 }

export class StickyHost {
  private readonly windows = new Map<string, EditorWindow>()
  private vaultRoot: string | null = null
  private tray: Tray | null = null
  trayAvailable = false

  constructor(
    private readonly accessor: Accessor,
    private readonly windowManager: WindowManager,
    private readonly showMain: () => void
  ) {}

  createTray(iconPath: string): boolean {
    try {
      const image = nativeImage.createFromPath(iconPath)
      if (image.isEmpty()) return false
      this.tray = new Tray(image)
      this.tray.setToolTip(t('app.displayName'))
      this.refreshTrayMenu()
      this.trayAvailable = true
      return true
    } catch {
      this.tray = null
      return false
    }
  }

  setVault(vaultRoot: string): void {
    this.vaultRoot = vaultRoot
  }

  restore(vaultRoot: string): void {
    this.vaultRoot = vaultRoot
    const state = loadUiState(vaultRoot)
    this.applyLogin(state.openAtLogin)
    for (const sticky of state.stickies) {
      if (existsSync(sticky.path)) this.open(vaultRoot, sticky.path)
    }
  }

  open(vaultRoot: string, notePath: string): void {
    this.vaultRoot = vaultRoot
    const key = normalizeNotePath(notePath)
    const existing = this.windows.get(key)
    if (existing?.browserWindow && !existing.browserWindow.isDestroyed()) {
      existing.bringToFront()
      return
    }
    const saved = findSticky(loadUiState(vaultRoot), notePath)
    const record = saved ?? {
      path: notePath,
      ...DEFAULT_BOUNDS,
      pinned: true,
      color: '#fff4cc'
    }
    const editor = new EditorWindow(this.accessor)
    editor.stickyProbe = true
    editor.stickyPath = notePath
    editor.stickyPinned = record.pinned
    editor.stickyColor = record.color
    editor.onStickyBounds = (bounds) => {
      this.remember(notePath, { ...record, ...bounds, pinned: editor.stickyPinned, color: editor.stickyColor })
    }
    editor.createWindow(null, [notePath], [], {
      x: record.x,
      y: record.y,
      width: record.width,
      height: record.height,
      frame: false,
      transparent: false,
      alwaysOnTop: record.pinned,
      backgroundColor: record.color
    })
    this.windowManager.add(editor)
    this.windows.set(key, editor)
    this.remember(notePath, record)
    editor.on('window-closed', () => {
      this.windows.delete(key)
    })
  }

  forget(notePath: string): void {
    if (!this.vaultRoot) return
    const state = closeSticky(loadUiState(this.vaultRoot), notePath)
    saveUiState(this.vaultRoot, state)
    this.windows.delete(normalizeNotePath(notePath))
  }

  setPinned(notePath: string, pinned: boolean): void {
    const editor = this.windows.get(normalizeNotePath(notePath))
    if (!editor?.browserWindow) return
    editor.stickyPinned = pinned
    editor.browserWindow.setAlwaysOnTop(pinned, 'floating')
    const bounds = editor.browserWindow.getBounds()
    this.remember(notePath, {
      path: notePath,
      ...bounds,
      pinned,
      color: editor.stickyColor
    })
  }

  setColor(notePath: string, color: string): void {
    const editor = this.windows.get(normalizeNotePath(notePath))
    if (!editor?.browserWindow) return
    editor.stickyColor = color
    editor.browserWindow.setBackgroundColor(color)
    const bounds = editor.browserWindow.getBounds()
    this.remember(notePath, {
      path: notePath,
      ...bounds,
      pinned: editor.stickyPinned,
      color
    })
  }

  capture(): void {
    if (!this.vaultRoot) return
    const inbox = join(this.vaultRoot, 'inbox.md')
    const line = '- [ ] \n'
    appendFileSync(inbox, line)
    this.open(this.vaultRoot, inbox)
    this.showMain()
  }

  toggleLogin(): void {
    if (!this.vaultRoot) return
    const state = loadUiState(this.vaultRoot)
    state.openAtLogin = !state.openAtLogin
    saveUiState(this.vaultRoot, state)
    this.applyLogin(state.openAtLogin)
    this.refreshTrayMenu()
  }

  private remember(notePath: string, record: StickyRecord): void {
    if (!this.vaultRoot) return
    saveUiState(this.vaultRoot, upsertSticky(loadUiState(this.vaultRoot), record))
  }

  private applyLogin(enabled: boolean): void {
    if (!app.isReady()) return
    try {
      app.setLoginItemSettings({ openAtLogin: enabled })
    } catch {
      // Linux may not have a login-item API. The flag still stays in ui-state.
    }
  }

  private refreshTrayMenu(): void {
    if (!this.tray || !this.vaultRoot) return
    const state = loadUiState(this.vaultRoot)
    this.tray.setContextMenu(Menu.buildFromTemplate([
      { label: t('sticky.capture'), click: () => this.capture() },
      { label: t('sticky.show'), click: () => this.showMain() },
      {
        label: t('sticky.login'),
        type: 'checkbox',
        checked: state.openAtLogin,
        click: () => this.toggleLogin()
      },
      { type: 'separator' },
      { label: t('sticky.quit'), click: () => app.quit() }
    ]))
  }
}

let host: StickyHost | null = null
let quitting = false

export function markQuitting(): void {
  quitting = true
}

export function isQuitting(): boolean {
  return quitting
}

export function setStickyHost(value: StickyHost | null): void {
  host = value
}

export function getStickyHost(): StickyHost | null {
  return host
}

export function stickyBounds(record: StickyRecord | null): WindowRect {
  return record
    ? { x: record.x, y: record.y, width: record.width, height: record.height }
    : DEFAULT_BOUNDS
}

export function isWaylandSession(): boolean {
  return process.platform === 'linux' && (process.env.XDG_SESSION_TYPE === 'wayland' || !!process.env.WAYLAND_DISPLAY)
}
