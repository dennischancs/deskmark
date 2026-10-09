export const STICKY_COLORS = ['#fff4cc', '#fde2e4', '#e2f0cb', '#d6e6ff', '#f8e1ff', '#ffe8d6'] as const

export type StickyColor = (typeof STICKY_COLORS)[number]
export const STICKY_FONT_SIZES = [14, 16, 18, 20] as const
export const DEFAULT_STICKY_FONT = 16
export const MIN_STICKY_OPACITY = 10
export const MAX_STICKY_OPACITY = 100

export interface StickyRecord {
  path: string
  x: number
  y: number
  width: number
  height: number
  pinned: boolean
  color: string
  fontSize: number
  opacity: number
  edgeHide: boolean
  locked: boolean
  pass: boolean
  bottom: boolean
}

export interface StickyEdges {
  left: boolean
  right: boolean
  top: boolean
  bottom: boolean
}

export const defaultStickyEdges = (): StickyEdges => ({
  left: true,
  right: true,
  top: true,
  bottom: true
})

export function normalizeEdges(value: unknown): StickyEdges {
  const raw = value && typeof value === 'object' ? value as Partial<StickyEdges> : {}
  return {
    left: raw.left !== false,
    right: raw.right !== false,
    top: raw.top !== false,
    bottom: raw.bottom !== false
  }
}

export function edgesOf(state: UiStateFile): StickyEdges {
  return normalizeEdges(state.edges)
}

export interface UiStateFile {
  version: 1
  openAtLogin: boolean
  edges: StickyEdges
  stickies: StickyRecord[]
}

export function emptyUiState(): UiStateFile {
  return { version: 1, openAtLogin: false, edges: defaultStickyEdges(), stickies: [] }
}

export function normalizeNotePath(notePath: string): string {
  return notePath.replaceAll('\\', '/').replace(/\/+$/, '')
}

export function normalizeColor(color: unknown): string {
  const value = typeof color === 'string' ? color.trim() : ''
  const full = /^#([0-9a-fA-F]{6})$/.exec(value)
  if (full) return `#${full[1].toLowerCase()}`
  const short = /^#([0-9a-fA-F]{3})$/.exec(value)
  if (short) {
    const [r, g, b] = short[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  const known = STICKY_COLORS as readonly string[]
  return known.includes(value) ? value : STICKY_COLORS[0]
}

export interface StickyHsv {
  /** Degrees, 0 inclusive to 360 exclusive. Gray has no hue, so this is 0. */
  h: number
  /** Saturation from 0 to 1. */
  s: number
  /** Value from 0 to 1. */
  v: number
}

export function hexToHsv(color: string): StickyHsv {
  const hex = normalizeColor(color).slice(1)
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hue = ((h % 360) + 360) % 360
  const sat = Math.min(1, Math.max(0, s))
  const val = Math.min(1, Math.max(0, v))
  const chroma = val * sat
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1))
  const match = val - chroma
  let red = 0
  let green = 0
  let blue = 0
  if (hue < 60) {
    red = chroma
    green = x
  } else if (hue < 120) {
    red = x
    green = chroma
  } else if (hue < 180) {
    green = chroma
    blue = x
  } else if (hue < 240) {
    green = x
    blue = chroma
  } else if (hue < 300) {
    red = x
    blue = chroma
  } else {
    red = chroma
    blue = x
  }
  const channel = (part: number): string => Math.round((part + match) * 255).toString(16).padStart(2, '0')
  return `#${channel(red)}${channel(green)}${channel(blue)}`
}

export function normalizeStickyFont(value: unknown): number {
  const size = typeof value === 'number' ? value : Number(value)
  return (STICKY_FONT_SIZES as readonly number[]).includes(size) ? size : DEFAULT_STICKY_FONT
}

export function normalizeStickyOpacity(value: unknown): number {
  const opacity = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(opacity)) return MAX_STICKY_OPACITY
  return Math.min(MAX_STICKY_OPACITY, Math.max(MIN_STICKY_OPACITY, Math.round(opacity)))
}

export function readUiState(json: string): UiStateFile {
  try {
    const parsed = JSON.parse(json) as Partial<UiStateFile>
    const stickies = Array.isArray(parsed.stickies) ? parsed.stickies.filter(isSticky) : []
    return {
      version: 1,
      openAtLogin: parsed.openAtLogin === true,
      edges: normalizeEdges((parsed as { edges?: unknown }).edges),
      stickies: stickies.map(normalizeSticky)
    }
  } catch {
    return emptyUiState()
  }
}

export function upsertSticky(state: UiStateFile, record: StickyRecord): UiStateFile {
  const next = normalizeSticky(record)
  return {
    version: 1,
    openAtLogin: state.openAtLogin,
    edges: edgesOf(state),
    stickies: [...state.stickies.filter(item => normalizeNotePath(item.path) !== next.path), next]
  }
}

export function closeSticky(state: UiStateFile, notePath: string): UiStateFile {
  const key = normalizeNotePath(notePath)
  return {
    version: 1,
    openAtLogin: state.openAtLogin,
    edges: edgesOf(state),
    stickies: state.stickies.filter(item => normalizeNotePath(item.path) !== key)
  }
}

export function renameSticky(state: UiStateFile, oldPath: string, nextPath: string): UiStateFile {
  const found = findSticky(state, oldPath)
  if (!found) return state
  if (normalizeNotePath(found.path) === normalizeNotePath(nextPath)) return state
  return upsertSticky(closeSticky(state, oldPath), { ...found, path: nextPath })
}

export function findSticky(state: UiStateFile, notePath: string): StickyRecord | null {
  const key = normalizeNotePath(notePath)
  return state.stickies.find(item => normalizeNotePath(item.path) === key) ?? null
}

function normalizeSticky(record: StickyRecord): StickyRecord {
  const raw = record as StickyRecord & {
    fontSize?: unknown
    opacity?: unknown
    edgeHide?: unknown
    locked?: unknown
    pass?: unknown
    bottom?: unknown
    pinned?: unknown
  }
  return {
    path: normalizeNotePath(record.path),
    x: record.x,
    y: record.y,
    width: record.width >= 80 ? record.width : 360,
    height: record.height >= 80 ? record.height : 320,
    pinned: record.pinned !== false,
    color: normalizeColor(record.color),
    fontSize: normalizeStickyFont(raw.fontSize),
    opacity: normalizeStickyOpacity(raw.opacity),
    edgeHide: raw.edgeHide !== false,
    locked: raw.locked === true,
    pass: raw.pass === true,
    bottom: raw.bottom === true && raw.pinned === false
  }
}

function isSticky(value: unknown): value is StickyRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<StickyRecord>
  return typeof record.path === 'string' && typeof record.x === 'number' && typeof record.y === 'number'
}
