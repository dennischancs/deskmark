import { describe, expect, it } from 'vitest'
import { emptyUiState, readUiState, upsertSticky } from '../../../src/common/stickyModel'
import { hwndFromBuffer } from '../../../src/common/stickyHandle'
import {
  concealEdge,
  concealedFrame,
  outerEdges,
  snapToWorkArea
} from '../../../src/common/stickyEdge'

const work = { x: 0, y: 0, width: 1920, height: 1080 }
const note = { x: 40, y: 40, width: 360, height: 320 }

describe('sticky edge snap', () => {
  it('sticks a note that is close to a work-area edge', () => {
    const snapped = snapToWorkArea({ ...note, x: 10, y: 12 }, work)
    expect(snapped.frame).toMatchObject({ x: 0, y: 0 })
    expect(snapped.edges).toEqual(['left', 'top'])
    expect(snapToWorkArea({ ...note, x: 80 }, work).edges).toEqual([])
  })

  it('tucks only an outer edge and leaves a peek', () => {
    const displays = [
      { x: 0, y: 0, width: 1920, height: 1080 },
      { x: 1920, y: 0, width: 1920, height: 1080 }
    ]
    expect(outerEdges(displays[0], displays)).toEqual(['left', 'top', 'bottom'])
    expect(concealEdge(['right'], outerEdges(displays[0], displays))).toBeNull()
    expect(concealEdge(['left', 'top'], outerEdges(displays[0], displays))).toBe('left')
    expect(concealedFrame({ ...note, x: 0 }, work, 'left')).toMatchObject({ x: -352 })
  })

  it('keeps edge hide on unless the note turned it off', () => {
    const base = {
      path: 'D:/notes/a.md',
      x: 1,
      y: 2,
      width: 360,
      height: 320,
      pinned: true,
      color: '#fff4cc',
      fontSize: 16,
      opacity: 100,
      edgeHide: true,
      locked: false,
      pass: false,
      bottom: false
    }
    const kept = upsertSticky(emptyUiState(), { ...base, edgeHide: false })
    expect(kept.stickies[0]?.edgeHide).toBe(false)
    const implied = upsertSticky(emptyUiState(), { ...base, edgeHide: undefined as unknown as boolean })
    expect(implied.stickies[0]?.edgeHide).toBe(true)
  })

  it('keeps lock, click-through, and bottom off unless chosen', () => {
    const saved = readUiState(JSON.stringify({
      version: 1,
      stickies: [{ path: 'a.md', x: 1, y: 2, locked: true, pass: true, pinned: true, bottom: true }]
    }))
    expect(saved.stickies[0]).toMatchObject({ locked: true, pass: true, bottom: false, pinned: true })
  })

  it('reads a native window handle from a little-endian buffer', () => {
    const buffer = new Uint8Array(8)
    const view = new DataView(buffer.buffer)
    view.setBigUint64(0, 0x12345678n, true)
    expect(hwndFromBuffer(buffer)).toBe(0x12345678n)
    expect(hwndFromBuffer(new Uint8Array(2))).toBeNull()
  })
})
