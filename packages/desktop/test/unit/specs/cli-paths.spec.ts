import path from 'path'
import { describe, expect, it } from 'vitest'
import { withoutApplicationDir } from '../../../src/main/cli/parser'

describe('launch paths', () => {
  it('does not treat the application directory as a note folder', () => {
    const appDir = path.resolve('D:/deskmark/packages/desktop')
    const notes = path.resolve('D:/notes/vault')
    expect(withoutApplicationDir([appDir, notes], appDir)).toEqual([notes])
  })
})
