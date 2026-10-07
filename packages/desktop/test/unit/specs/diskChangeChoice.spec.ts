import { describe, expect, it } from 'vitest'
import { diskChangeChoice } from 'common/diskChange'

describe('disk change choices', () => {
  it('keeps edits unless the user reloads or saves a copy', () => {
    expect(diskChangeChoice(false)).toBe('keep')
    expect(diskChangeChoice('keep')).toBe('keep')
    expect(diskChangeChoice(undefined)).toBe('keep')
    expect(diskChangeChoice(true)).toBe('reload')
    expect(diskChangeChoice('reload')).toBe('reload')
    expect(diskChangeChoice('save-as')).toBe('save-as')
  })
})
