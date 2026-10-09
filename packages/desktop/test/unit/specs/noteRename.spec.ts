import { describe, expect, it } from 'vitest'
import {
  nextNoteFilename,
  pathIsRemembered,
  rememberPath,
  retargetOpenPath,
  type TimedPath
} from '../../../src/common/noteRename'

describe('note rename', () => {
  it('keeps a markdown extension and refuses a name that leaves the folder', () => {
    expect(nextNoteFilename('01ABC.md', '购物清单')).toEqual({ ok: true, filename: '购物清单.md' })
    expect(nextNoteFilename('01ABC.md', '购物清单.md')).toEqual({ ok: true, filename: '购物清单.md' })
    expect(nextNoteFilename('01ABC.md', '01ABC')).toEqual({ ok: false, reason: 'unchanged' })
    expect(nextNoteFilename('01ABC.md', '../other')).toEqual({ ok: false, reason: 'invalid' })
    expect(nextNoteFilename('01ABC.md', '   ')).toEqual({ ok: false, reason: 'unchanged' })
  })

  it('moves every open tab onto the new path and remembers the old one', () => {
    const tabs = [
      { pathname: '/vault/stickies/a.md', filename: 'a.md' },
      { pathname: '/vault/other.md', filename: 'other.md' }
    ]
    const changed = retargetOpenPath(tabs, '/vault/stickies/a.md', '/vault/stickies/b.md', (left, right) => left === right)
    expect(changed).toBe(1)
    expect(tabs[0]).toEqual({ pathname: '/vault/stickies/b.md', filename: 'b.md' })
    expect(tabs[1]?.pathname).toBe('/vault/other.md')

    const entries: TimedPath[] = []
    rememberPath(entries, '/vault/stickies/a.md', 1_000, 500)
    expect(pathIsRemembered(entries, '\\vault\\stickies\\a.md', 1_200)).toBe(true)
    expect(pathIsRemembered(entries, '/vault/stickies/a.md', 1_600)).toBe(false)
  })
})
