import { describe, expect, it } from 'vitest'
import { applyTaskEdit } from '../../../../../packages/deskmark-core/src/index.ts'

describe('checking a task keeps its note', () => {
  it('leaves the unknown comment keys in place after the box is checked', () => {
    const markdown = '- [ ] 买牛奶 <!-- deskmark: id=OLD; due=2026-10-08; vendor=keep -->\n'
    const result = applyTaskEdit(markdown, 1, { checked: true }, new Date('2026-10-06T10:00:00.000Z'), 'Asia/Shanghai', ['NEXT'])
    expect(result.markdown).toContain('vendor=keep')
    expect(result.markdown).toContain('[x]')
    expect(result.markdown.startsWith('- [x] 买牛奶')).toBe(true)
  })
})
