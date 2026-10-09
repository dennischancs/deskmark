import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stickyNotesDirectory } from '../../../src/common/stickyDir'

describe('sticky note folder', () => {
  it('uses stickies inside the open folder when the setting is empty', () => {
    expect(stickyNotesDirectory('/vault/notes', '')).toBe(join('/vault/notes', 'stickies'))
    expect(stickyNotesDirectory('/vault/notes', '   ')).toBe(join('/vault/notes', 'stickies'))
  })

  it('accepts an absolute folder, a folder relative to the vault, and a home path', () => {
    expect(stickyNotesDirectory('/vault/notes', '/tmp/desk')).toBe('/tmp/desk')
    expect(stickyNotesDirectory('/vault/notes', 'inbox/notes')).toBe(join('/vault/notes', 'inbox', 'notes'))
    expect(stickyNotesDirectory('/vault/notes', '~/Desk')).toBe(join(homedir(), 'Desk'))
  })
})
