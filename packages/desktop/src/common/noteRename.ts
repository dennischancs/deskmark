export interface TimedPath {
  path: string
  until: number
}

export type NoteNameResult =
  | { ok: true, filename: string }
  | { ok: false, reason: 'unchanged' | 'invalid' }

// Same stems as MARKDOWN_EXTENSIONS. This file is imported by the renderer,
// so it cannot pull in the filesystem helper that lists them.
const NOTE_EXTENSIONS = ['markdown', 'mdown', 'mkdn', 'md', 'mkd', 'mdwn', 'mdtxt', 'mdtext', 'mdx', 'text', 'txt']

const hasNoteExtension = (name: string): boolean => {
  const lower = name.toLowerCase()
  return NOTE_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`))
}

const leavesFolder = (name: string): boolean => {
  if (/[\\/<>:"|?*]/.test(name)) return true
  for (let index = 0; index < name.length; index += 1) {
    if (name.charCodeAt(index) < 32) return true
  }
  return false
}

export function loosePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase()
}

// Keep a markdown extension when the user types only the stem. A separator
// would let the name escape the note's folder, so those are refused.
export function nextNoteFilename(currentName: string, requested: string): NoteNameResult {
  const trimmed = requested.trim()
  if (!trimmed || trimmed === '.' || trimmed === '..' || leavesFolder(trimmed)) {
    return { ok: false, reason: trimmed && trimmed !== currentName ? 'invalid' : 'unchanged' }
  }
  const name = hasNoteExtension(currentName) && !hasNoteExtension(trimmed) ? `${trimmed}.md` : trimmed
  if (name === currentName) return { ok: false, reason: 'unchanged' }
  return { ok: true, filename: name }
}

export function retargetOpenPath<T extends { pathname?: string, filename?: string }>(
  tabs: T[],
  from: string,
  to: string,
  same: (left: string, right: string) => boolean
): number {
  const filename = to.split(/[/\\]/).pop() || to
  let count = 0
  for (const tab of tabs) {
    if (!tab.pathname || !same(tab.pathname, from)) continue
    tab.pathname = to
    tab.filename = filename
    count += 1
  }
  return count
}

export function rememberPath(entries: TimedPath[], pathname: string, now: number, duration: number): void {
  const path = loosePath(pathname)
  const until = now + duration
  const existing = entries.find((entry) => entry.path === path)
  if (existing) existing.until = Math.max(existing.until, until)
  else entries.push({ path, until })
}

export function pathIsRemembered(entries: TimedPath[], pathname: string, now: number): boolean {
  const path = loosePath(pathname)
  const live = entries.filter((entry) => entry.until > now)
  entries.splice(0, entries.length, ...live)
  return live.some((entry) => entry.path === path)
}
