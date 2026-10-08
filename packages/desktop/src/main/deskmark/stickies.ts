import { appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { app, Menu, Tray, nativeImage, screen } from 'electron'
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import type { WindowRect } from 'common/windowRect'
import {
  closeSticky,
  findSticky,
  normalizeNotePath,
  upsertSticky,
  type StickyRecord
} from 'common/stickyModel'
import {
  concealEdge,
  concealedFrame,
  frameContains,
  framesEqual,
  mostlyOnScreen,
  outerEdges,
  peekFrame,
  snapToWorkArea,
  type Frame,
  type StickyEdge
} from 'common/stickyEdge'
import { loadUiState, saveUiState } from 'common/stickyFile'
import { t } from '../i18n'
import EditorWindow from '../windows/editor'
import type WindowManager from '../app/windowManager'
import type Accessor from '../app/accessor'
import { trayMenuEntries, type TrayAction } from './trayMenu'

const DEFAULT_BOUNDS = { x: 80, y: 80, width: 360, height: 320 }

interface Dock {
  edgeHide: boolean
  logical: Frame
  edge: StickyEdge | null
  concealed: boolean
  dragging: boolean
  hideTimer: ReturnType<typeof setTimeout> | null
  slide: number
  /** Trailing move events from a tuck must not replace the parked place. */
  ignoreUntil: number
}

// The packaged icon lives in resources/static. A dev run still has static/ next to the working directory.
export function resolveTrayIcon(
  resourcesPath: string,
  cwd: string,
  exists: (file: string) => boolean
): string | null {
  const candidates = [
    join(resourcesPath, 'static', 'logo-small.png'),
    join(cwd, 'static', 'logo-small.png')
  ]
  return candidates.find(file => exists(file)) ?? null
}

export class StickyHost {
  private readonly windows = new Map<string, EditorWindow>()
  private vaultRoot: string | null = null
  private tray: Tray | null = null
  private trayMenu: Menu | null = null
  private trayClicksBound = false
  trayAvailable = false
  private trayPops = 0
  private readonly docks = new Map<string, Dock>()
  private cursorWatch: ReturnType<typeof setInterval> | null = null

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
      this.bindTrayClicks()
      this.publishTrayHook()
      this.trayAvailable = true
      return true
    } catch {
      this.tray = null
      return false
    }
  }

  setVault(vaultRoot: string): void {
    this.vaultRoot = vaultRoot
    this.refreshTrayMenu()
  }

  restore(vaultRoot: string): void {
    this.vaultRoot = vaultRoot
    const state = loadUiState(vaultRoot)
    this.applyLogin(state.openAtLogin)
    for (const sticky of state.stickies) {
      if (existsSync(sticky.path)) this.open(vaultRoot, sticky.path)
    }
    this.refreshTrayMenu()
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
      color: '#fff4cc',
      fontSize: 16,
      opacity: 100,
      edgeHide: true
    }
    const editor = new EditorWindow(this.accessor)
    editor.stickyProbe = true
    editor.stickyPath = notePath
    editor.stickyPinned = record.pinned
    editor.stickyColor = record.color
    editor.stickyFont = record.fontSize
    editor.stickyOpacity = record.opacity
    editor.stickyEdgeHide = record.edgeHide
    const logical = { x: record.x, y: record.y, width: record.width, height: record.height }
    this.docks.set(key, {
      edgeHide: record.edgeHide,
      logical,
      edge: null,
      concealed: false,
      dragging: false,
      hideTimer: null,
      slide: 0,
      ignoreUntil: 0
    })
    editor.onStickyBounds = (bounds) => {
      this.settle(editor, notePath, bounds)
    }
    editor.onStickyDrag = () => {
      const dock = this.docks.get(key)
      if (!dock || Date.now() < dock.ignoreUntil) return
      dock.dragging = true
      dock.ignoreUntil = 0
      this.cancelHide(dock)
      if (dock.concealed) this.reveal(editor, key, false)
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
    this.ensureCursorWatch()
    editor.on('window-closed', () => {
      this.windows.delete(key)
      this.dropDock(key)
    })
  }

  forget(notePath: string): void {
    if (!this.vaultRoot) return
    const state = closeSticky(loadUiState(this.vaultRoot), notePath)
    saveUiState(this.vaultRoot, state)
    this.windows.delete(normalizeNotePath(notePath))
    this.dropDock(normalizeNotePath(notePath))
  }

  setPinned(notePath: string, pinned: boolean): void {
    const editor = this.windows.get(normalizeNotePath(notePath))
    if (!editor?.browserWindow) return
    editor.stickyPinned = pinned
    editor.browserWindow.setAlwaysOnTop(pinned, 'floating')
    this.remember(notePath, this.snapshot(editor, notePath, editor.browserWindow.getBounds()))
  }

  setColor(notePath: string, color: string): void {
    const editor = this.windows.get(normalizeNotePath(notePath))
    if (!editor?.browserWindow) return
    editor.stickyColor = color
    editor.browserWindow.setBackgroundColor(color)
    this.remember(notePath, this.snapshot(editor, notePath, editor.browserWindow.getBounds()))
  }

  setFont(notePath: string, fontSize: number): void {
    const editor = this.windows.get(normalizeNotePath(notePath))
    if (!editor?.browserWindow) return
    editor.stickyFont = fontSize
    this.remember(notePath, this.snapshot(editor, notePath, editor.browserWindow.getBounds()))
  }

  setOpacity(notePath: string, opacity: number): boolean {
    const editor = this.windows.get(normalizeNotePath(notePath))
    if (!editor?.browserWindow) return false
    try {
      editor.browserWindow.setOpacity(opacity / 100)
    } catch {
      return false
    }
    editor.stickyOpacity = opacity
    this.remember(notePath, this.snapshot(editor, notePath, editor.browserWindow.getBounds()))
    return true
  }

  setEdgeHide(notePath: string, enabled: boolean): void {
    const key = normalizeNotePath(notePath)
    const editor = this.windows.get(key)
    const dock = this.docks.get(key)
    if (!editor?.browserWindow || !dock) return
    editor.stickyEdgeHide = enabled
    dock.edgeHide = enabled
    dock.ignoreUntil = 0
    editor.stickyAdjusting = false
    if (!enabled) {
      dock.edge = null
      this.cancelHide(dock)
      this.reveal(editor, key, true)
    } else {
      this.settle(editor, notePath, dock.logical)
    }
    this.remember(notePath, this.snapshot(editor, notePath, dock.logical))
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
    this.setLogin(!this.loginEnabled())
  }

  loginEnabled(): boolean {
    if (this.vaultRoot) return loadUiState(this.vaultRoot).openAtLogin
    try {
      return app.getLoginItemSettings().openAtLogin
    } catch {
      return false
    }
  }

  setLogin(enabled: boolean): void {
    if (this.vaultRoot) {
      const state = loadUiState(this.vaultRoot)
      state.openAtLogin = enabled
      saveUiState(this.vaultRoot, state)
    }
    this.applyLogin(enabled)
    this.refreshTrayMenu()
  }

  private remember(notePath: string, record: StickyRecord): void {
    if (!this.vaultRoot) return
    saveUiState(this.vaultRoot, upsertSticky(loadUiState(this.vaultRoot), record))
  }

  private snapshot(editor: EditorWindow, notePath: string, bounds: { x: number, y: number, width: number, height: number }): StickyRecord {
    const dock = this.docks.get(normalizeNotePath(notePath))
    const placed = dock?.logical ?? bounds
    return {
      path: notePath,
      ...placed,
      pinned: editor.stickyPinned,
      color: editor.stickyColor,
      fontSize: editor.stickyFont,
      opacity: editor.stickyOpacity,
      edgeHide: editor.stickyEdgeHide
    }
  }

  private settle(editor: EditorWindow, notePath: string, bounds: Frame): void {
    const key = normalizeNotePath(notePath)
    const dock = this.docks.get(key)
    const win = editor.browserWindow
    if (!dock || !win || win.isDestroyed()) return
    if (editor.stickyAdjusting) return
    let displays: ReturnType<typeof screen.getAllDisplays> = []
    try {
      displays = screen.getAllDisplays()
    } catch {
      this.remember(notePath, this.snapshot(editor, notePath, bounds))
      return
    }
    const display = screen.getDisplayMatching(dock.concealed ? dock.logical : bounds)
    const work = display.workArea
    if (Date.now() < dock.ignoreUntil && !this.userMoved(dock, bounds, work)) return
    if (dock.concealed && !mostlyOnScreen(bounds, display.workArea)) return
    dock.dragging = false
    dock.ignoreUntil = 0
    const snapped = snapToWorkArea(bounds, work)
    const outer = outerEdges(work, displays.map(item => item.bounds))
    dock.logical = snapped.frame
    dock.edge = dock.edgeHide ? concealEdge(snapped.edges, outer) : null
    dock.concealed = false
    this.cancelHide(dock)
    if (!framesEqual(bounds, snapped.frame)) this.place(editor, dock, snapped.frame, false)
    this.remember(notePath, this.snapshot(editor, notePath, snapped.frame))
    if (dock.edge) this.scheduleHide(editor, key)
    this.ensureCursorWatch()
  }

  private scheduleHide(editor: EditorWindow, key: string): void {
    const dock = this.docks.get(key)
    if (!dock?.edge || !dock.edgeHide || dock.concealed || dock.dragging || dock.hideTimer) return
    dock.hideTimer = setTimeout(() => {
      dock.hideTimer = null
      if (!dock.dragging && !editor.stickyAdjusting) this.conceal(editor, key)
    }, 400)
  }

  private userMoved(dock: Dock, bounds: Frame, work: Frame): boolean {
    if (!mostlyOnScreen(bounds, work)) return false
    if (this.nearFrame(bounds, dock.logical)) return false
    if (dock.edge && this.nearFrame(bounds, concealedFrame(dock.logical, work, dock.edge))) return false
    return true
  }

  private nearFrame(a: Frame, b: Frame): boolean {
    return Math.abs(a.x - b.x) <= 2 && Math.abs(a.y - b.y) <= 2 && a.width === b.width && a.height === b.height
  }

  private cancelHide(dock: Dock): void {
    if (!dock.hideTimer) return
    clearTimeout(dock.hideTimer)
    dock.hideTimer = null
  }

  private conceal(editor: EditorWindow, key: string): void {
    const dock = this.docks.get(key)
    const win = editor.browserWindow
    if (!dock?.edge || !win || win.isDestroyed() || dock.concealed) return
    let work: Frame
    try {
      work = screen.getDisplayMatching(dock.logical).workArea
    } catch {
      return
    }
    dock.concealed = true
    this.place(editor, dock, concealedFrame(dock.logical, work, dock.edge), true)
  }

  private reveal(editor: EditorWindow, key: string, animate: boolean): void {
    const dock = this.docks.get(key)
    if (!dock) return
    this.cancelHide(dock)
    if (!dock.concealed) return
    dock.concealed = false
    this.place(editor, dock, dock.logical, animate)
  }

  private place(editor: EditorWindow, dock: Dock, target: Frame, animate: boolean): void {
    const win = editor.browserWindow
    if (!win || win.isDestroyed()) return
    const token = dock.slide + 1
    dock.slide = token
    const finish = (): void => {
      if (dock.slide !== token) return
      editor.stickyAdjusting = false
    }
    editor.stickyAdjusting = true
    dock.ignoreUntil = Date.now() + 400
    if (!animate) {
      win.setBounds(target)
      setTimeout(finish, 80)
      return
    }
    const from = win.getBounds()
    const steps = 6
    let step = 0
    const tick = (): void => {
      if (dock.slide !== token || win.isDestroyed()) return
      step += 1
      const t = step / steps
      editor.stickyAdjusting = true
      win.setBounds({
        x: Math.round(from.x + (target.x - from.x) * t),
        y: Math.round(from.y + (target.y - from.y) * t),
        width: target.width,
        height: target.height
      })
      if (step < steps) setTimeout(tick, 16)
      else finish()
    }
    tick()
  }

  private ensureCursorWatch(): void {
    if (this.cursorWatch) return
    this.cursorWatch = setInterval(() => this.followCursor(), 80)
  }

  private followCursor(): void {
    if (this.docks.size === 0) {
      if (this.cursorWatch) clearInterval(this.cursorWatch)
      this.cursorWatch = null
      return
    }
    let point: { x: number, y: number }
    try {
      point = screen.getCursorScreenPoint()
    } catch {
      return
    }
    for (const [key, editor] of this.windows) {
      const dock = this.docks.get(key)
      if (!dock?.edge || !dock.edgeHide || dock.dragging || editor.stickyAdjusting) continue
      let work: Frame
      try {
        work = screen.getDisplayMatching(dock.logical).workArea
      } catch {
        continue
      }
      if (dock.concealed) {
        const peek = peekFrame(dock.logical, work, dock.edge)
        if (frameContains(peek, point.x, point.y)) this.reveal(editor, key, true)
        continue
      }
      if (frameContains(dock.logical, point.x, point.y)) {
        this.cancelHide(dock)
        continue
      }
      this.scheduleHide(editor, key)
    }
  }

  private dropDock(key: string): void {
    const dock = this.docks.get(key)
    if (!dock) return
    this.cancelHide(dock)
    dock.slide += 1
    this.docks.delete(key)
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
    if (!this.tray) return
    const template: MenuItemConstructorOptions[] = trayMenuEntries().map(entry => {
      if (entry.separator) return { type: 'separator' }
      const label = t(entry.labelKey || '')
      if (entry.checkbox) {
        return {
          label,
          type: 'checkbox',
          checked: this.loginEnabled(),
          click: () => this.runTrayAction(entry.action)
        }
      }
      return { label, click: () => this.runTrayAction(entry.action) }
    })
    this.trayMenu = Menu.buildFromTemplate(template)
    this.publishTrayHook()
  }

  // Windows only opens a menu set with setContextMenu on right-click, and that
  // menu used to wait until a folder was open, so neither button did anything.
  // Both buttons pop the same menu, including before a folder is chosen.
  private bindTrayClicks(): void {
    if (!this.tray || this.trayClicksBound) return
    this.trayClicksBound = true
    const pop = (): void => {
      this.trayPops += 1
      this.refreshTrayMenu()
      if (this.tray && this.trayMenu) this.tray.popUpContextMenu(this.trayMenu)
    }
    this.tray.on('click', pop)
    this.tray.on('right-click', pop)
  }

  private runTrayAction(action: TrayAction | undefined): void {
    if (action === 'newFile') this.newFile()
    else if (action === 'tasks') this.showDeskmark('tasks')
    else if (action === 'calendar') this.showDeskmark('calendar')
    else if (action === 'note') this.openSticky()
    else if (action === 'show') this.showMain()
    else if (action === 'login') this.toggleLogin()
    else if (action === 'quit') app.quit()
  }

  private publishTrayHook(): void {
    if (process.env.DESKMARK_E2E !== '1' || !this.tray) return
    const tray = this.tray
    const labels = this.trayMenu?.items.flatMap(item => item.label ? [item.label] : []) ?? []
    const hook = {
      labels,
      pops: this.trayPops,
      click: tray.listenerCount('click'),
      rightClick: tray.listenerCount('right-click')
    }
    ;(global as typeof globalThis & { __deskmarkTray?: typeof hook }).__deskmarkTray = hook
  }

  private mainBrowser(): BrowserWindow | null {
    this.showMain()
    const editors = this.windowManager.getWindowsByType('editor')
    const main = editors.find(entry => !(entry.win as EditorWindow).stickyPath)
    const browser = main?.win.browserWindow
    if (!browser || browser.isDestroyed()) return null
    return browser
  }

  private whenReady(browser: BrowserWindow, send: () => void): void {
    if (browser.isDestroyed()) return
    if (browser.webContents.isLoading()) {
      browser.webContents.once('did-finish-load', send)
      return
    }
    send()
  }

  private newFile(): void {
    const browser = this.mainBrowser()
    if (!browser) return
    this.whenReady(browser, () => {
      if (browser.isDestroyed()) return
      browser.webContents.send('mt::new-untitled-tab')
      browser.webContents.send('mt::set-view-layout', { showTabBar: true })
    })
  }

  private showDeskmark(target: 'tasks' | 'calendar'): void {
    const browser = this.mainBrowser()
    if (!browser) return
    this.whenReady(browser, () => {
      if (!browser.isDestroyed()) browser.webContents.send('mt::deskmark-show', target)
    })
  }

  private openSticky(): void {
    if (this.vaultRoot) {
      this.capture()
      return
    }
    this.showMain()
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
