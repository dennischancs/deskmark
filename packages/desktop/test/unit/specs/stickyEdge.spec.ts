import { describe, expect, it } from 'vitest'
import { emptyUiState, upsertSticky } from '../../../src/common/stickyModel'
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
      edgeHide: true
    }
    const kept = upsertSticky(emptyUiState(), { ...base, edgeHide: false })
    expect(kept.stickies[0]?.edgeHide).toBe(false)
    const implied = upsertSticky(emptyUiState(), { ...base, edgeHide: undefined as unknown as boolean })
    expect(implied.stickies[0]?.edgeHide).toBe(true)
  })
})
