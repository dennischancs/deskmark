import { describe, expect, it } from 'vitest'
import { STICKY_COLORS, hexToHsv, hsvToHex } from '../../../src/common/stickyModel'
import { placeStickyPalette } from '../../../src/common/stickyPalette'

describe('sticky palette', () => {
  it('turns a picked color back into the same hex', () => {
    const colors = [...STICKY_COLORS, '#336699', '#000000', '#ffffff', '#808080']
    for (const color of colors) {
      const hsv = hexToHsv(color)
      expect(hsvToHex(hsv.h, hsv.s, hsv.v)).toBe(color)
    }
  })

  it('keeps the palette inside a short sticky window', () => {
    expect(placeStickyPalette(
      { left: 10, top: 10, width: 40, height: 20 },
      { width: 100, height: 80 },
      { width: 400, height: 300 }
    )).toEqual({ left: 10, top: 34 })

    expect(placeStickyPalette(
      { left: 10, top: 250, width: 40, height: 20 },
      { width: 100, height: 80 },
      { width: 400, height: 300 }
    )).toEqual({ left: 10, top: 166 })

    expect(placeStickyPalette(
      { left: 350, top: 10, width: 40, height: 20 },
      { width: 100, height: 80 },
      { width: 400, height: 300 }
    )).toEqual({ left: 292, top: 34 })
  })
})
