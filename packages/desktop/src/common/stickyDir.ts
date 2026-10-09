import { homedir } from 'node:os'
import { isAbsolute, join, normalize } from 'node:path'

// An empty setting means "the stickies folder inside the open vault". A value
// is either absolute, relative to that vault, or ~/... for the home directory.
export function stickyNotesDirectory(vaultRoot: string, configured: string | null | undefined): string {
  const custom = (configured ?? '').trim()
  if (!custom) return join(vaultRoot, 'stickies')
  let expanded = custom
  if (custom === '~') expanded = homedir()
  else if (custom.startsWith('~/') || custom.startsWith('~\\')) expanded = join(homedir(), custom.slice(2))
  if (isAbsolute(expanded)) return normalize(expanded)
  return normalize(join(vaultRoot, expanded))
}
