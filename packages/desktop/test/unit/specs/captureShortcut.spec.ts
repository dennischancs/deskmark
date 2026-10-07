import { describe, expect, it } from 'vitest'
import { DEFAULT_CAPTURE_ACCELERATOR, normalizeCaptureAccelerator } from 'common/captureShortcut'

describe('capture shortcut', () => {
  it('uses Ctrl+Alt+N unless the user clears it or types a modified accelerator', () => {
    expect(normalizeCaptureAccelerator(undefined)).toBe(DEFAULT_CAPTURE_ACCELERATOR)
    expect(normalizeCaptureAccelerator('')).toBe('')
    expect(normalizeCaptureAccelerator('   ')).toBe('')
    expect(normalizeCaptureAccelerator('N')).toBe(DEFAULT_CAPTURE_ACCELERATOR)
    expect(normalizeCaptureAccelerator('Ctrl+Alt+N')).toBe('Ctrl+Alt+N')
    expect(normalizeCaptureAccelerator('not a shortcut')).toBe(DEFAULT_CAPTURE_ACCELERATOR)
  })
})
