import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OpenSession, shouldPreserveOpenSession } from '../../../src/common/openSession'
import { largeFileMode, prefersSourceMode, SOURCE_ONLY_BYTES, SUGGEST_SOURCE_BYTES } from '../../../src/common/sessionRules'

describe('open file session', () => {
  it('keeps order and unsaved text without writing the original file', () => {
    const root = mkdtempSync(join(tmpdir(), 'deskmark-session-'))
    const original = join(root, 'notes.md')
    writeFileSync(original, '磁盘上的原文\n', 'utf8')
    const session = new OpenSession(join(root, 'open-session'))
    const tabs = Array.from({ length: 8 }, (_, index) => ({
      id: `file-${index}`,
      pathname: index === 0 ? '' : join(root, `n${index}.md`),
      filename: index === 3 ? 'plain.txt' : `n${index}.md`,
      markdown: `内容 ${index}`,
      isSaved: index !== 0 && index !== 1,
      cursor: { line: index }
    }))
    tabs[1].pathname = original
    tabs[1].markdown = '还没保存的新内容'

    const document = session.save('file-1', tabs)
    expect(document.files.map((file) => file.id)).toEqual(tabs.map((tab) => tab.id))
    expect(readFileSync(original, 'utf8')).toBe('磁盘上的原文\n')
    const loaded = session.load()
    expect(loaded.drafts['file-0']).toBe('内容 0')
    expect(loaded.drafts['file-1']).toBe('还没保存的新内容')
    expect(loaded.drafts['file-2']).toBeUndefined()
    expect(loaded.document.files[3].sourceMode).toBe(true)
    expect(loaded.document.files[2].sourceMode).toBe(false)

    session.save('file-2', tabs.filter((tab) => tab.id !== 'file-0' && tab.id !== 'file-1'))
    const afterClose = session.load()
    expect(afterClose.document.files.map((file) => file.id)).not.toContain('file-0')
    expect(afterClose.drafts['file-0']).toBeUndefined()
    expect(afterClose.drafts['file-1']).toBeUndefined()
    expect(readFileSync(original, 'utf8')).toBe('磁盘上的原文\n')
  })

  it('treats txt as source mode and markdown as the formatted mode', () => {
    expect(prefersSourceMode('notes.txt')).toBe(true)
    expect(prefersSourceMode('Notes.MD')).toBe(false)
  })

  it('keeps a 1 MB note editable and refuses the visual editor at 10 MB', () => {
    expect(largeFileMode(SUGGEST_SOURCE_BYTES - 1)).toBe('normal')
    expect(largeFileMode(SUGGEST_SOURCE_BYTES)).toBe('suggest-source')
    expect(largeFileMode(SOURCE_ONLY_BYTES - 1)).toBe('suggest-source')
    expect(largeFileMode(SOURCE_ONLY_BYTES)).toBe('source-only')
  })

  it('does not let a window that never had tabs erase the previous session', () => {
    expect(shouldPreserveOpenSession(2, 0, false)).toBe(true)
    expect(shouldPreserveOpenSession(2, 0, true)).toBe(false)
    expect(shouldPreserveOpenSession(0, 0, false)).toBe(false)
    expect(shouldPreserveOpenSession(2, 1, false)).toBe(false)
  })
})
