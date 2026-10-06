import { describe, expect, it } from 'vitest'
import { restoreWindowRect, type WindowRect } from '../../../src/common/windowRect'

const fallback: WindowRect = { x: 80, y: 80, width: 360, height: 320 }
const primary = { x: 0, y: 0, width: 1920, height: 1080 }

describe('probe B window rect', () => {
  it('restores a rectangle that still intersects a display', () => {
    const saved = { x: 400, y: 200, width: 360, height: 320 }
    expect(restoreWindowRect(saved, [primary], fallback)).toEqual(saved)
  })

  it('moves onto the primary display when the old screen is gone', () => {
    const saved = { x: 4000, y: 200, width: 360, height: 320 }
    expect(restoreWindowRect(saved, [primary], fallback)).toEqual({
      x: 0,
      y: 0,
      width: 360,
      height: 320
    })
  })

  it('uses the fallback when nothing was saved', () => {
    expect(restoreWindowRect(null, [primary], fallback)).toEqual(fallback)
  })
})
