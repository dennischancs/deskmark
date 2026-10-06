export const STICKY_COLORS = ['#fff4cc', '#fde2e4', '#e2f0cb', '#d6e6ff', '#f8e1ff', '#ffe8d6'] as const

export type StickyColor = (typeof STICKY_COLORS)[number]

export interface StickyRecord {
  path: string
  x: number
  y: number
  width: number
  height: number
  pinned: boolean
  color: string
}

export interface UiStateFile {
  version: 1
  openAtLogin: boolean
  stickies: StickyRecord[]
}

export function emptyUiState(): UiStateFile {
  return { version: 1, openAtLogin: false, stickies: [] }
}

export function normalizeNotePath(notePath: string): string {
  return notePath.replaceAll('\\', '/').replace(/\/+$/, '')
}

export function normalizeColor(color: string): StickyColor {
  const known = STICKY_COLORS as readonly string[]
  return known.includes(color) ? color as StickyColor : STICKY_COLORS[0]
}

export function readUiState(json: string): UiStateFile {
  try {
    const parsed = JSON.parse(json) as Partial<UiStateFile>
    const stickies = Array.isArray(parsed.stickies) ? parsed.stickies.filter(isSticky) : []
    return {
      version: 1,
      openAtLogin: parsed.openAtLogin === true,
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
    stickies: [...state.stickies.filter(item => normalizeNotePath(item.path) !== next.path), next]
  }
}

export function closeSticky(state: UiStateFile, notePath: string): UiStateFile {
  const key = normalizeNotePath(notePath)
  return {
    version: 1,
    openAtLogin: state.openAtLogin,
    stickies: state.stickies.filter(item => normalizeNotePath(item.path) !== key)
  }
}

export function findSticky(state: UiStateFile, notePath: string): StickyRecord | null {
  const key = normalizeNotePath(notePath)
  return state.stickies.find(item => normalizeNotePath(item.path) === key) ?? null
}

function normalizeSticky(record: StickyRecord): StickyRecord {
  return {
    path: normalizeNotePath(record.path),
    x: record.x,
    y: record.y,
    width: record.width >= 80 ? record.width : 360,
    height: record.height >= 80 ? record.height : 320,
    pinned: record.pinned !== false,
    color: normalizeColor(record.color)
  }
}

function isSticky(value: unknown): value is StickyRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<StickyRecord>
  return typeof record.path === 'string' && typeof record.x === 'number' && typeof record.y === 'number'
}
