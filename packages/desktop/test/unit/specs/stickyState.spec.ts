import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { closeSticky, emptyUiState, findSticky, upsertSticky } from '../../../src/common/stickyModel'
import { loadUiState, saveUiState } from '../../../src/common/stickyFile'

describe('sticky note state', () => {
  it('keeps one window record per note and does not store the note text', () => {
    const first = upsertSticky(emptyUiState(), {
      path: 'D:/notes/a.md',
      x: 10,
      y: 20,
      width: 360,
      height: 320,
      pinned: true,
      color: '#fff4cc'
    })
    const second = upsertSticky(first, {
      path: 'D:\\notes\\a.md',
      x: 40,
      y: 50,
      width: 400,
      height: 300,
      pinned: false,
      color: 'not-a-color'
    })
    expect(second.stickies).toHaveLength(1)
    expect(second.stickies[0]).toMatchObject({ x: 40, y: 50, pinned: false, color: '#fff4cc' })
    expect(JSON.stringify(second)).not.toContain('买牛奶')
    const closed = closeSticky(second, 'D:/notes/a.md')
    expect(closed.stickies).toHaveLength(0)
    expect(findSticky(closed, 'D:/notes/a.md')).toBeNull()
  })

  it('round-trips the ui state file without touching a note', () => {
    const root = mkdtempSync(join(tmpdir(), 'deskmark-sticky-'))
    const note = join(root, 'note.md')
    writeFileSync(note, '原文\n', 'utf8')
    saveUiState(root, upsertSticky(emptyUiState(), {
      path: note,
      x: 1,
      y: 2,
      width: 360,
      height: 320,
      pinned: true,
      color: '#d6e6ff'
    }))
    expect(loadUiState(root).stickies[0]?.color).toBe('#d6e6ff')
    expect(readFileSync(note, 'utf8')).toBe('原文\n')
  })
})
