import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { editTaskFile } from '../src/index.ts'

test('写回只改目标行，旁边的文件不动', () => {
  const root = mkdtempSync(join(tmpdir(), 'deskmark-edit-'))
  const file = join(root, 'a.md')
  const other = join(root, 'b.md')
  writeFileSync(file, '前文\n- [ ] 买牛奶\n后文\n', 'utf8')
  writeFileSync(other, '别动\n', 'utf8')
  const result = editTaskFile(file, 2, {
    due: '2026-10-09',
    remind: '2026-10-09T09:00:00+08:00'
  }, new Date('2026-10-06T01:00:00.000Z'), 'Asia/Shanghai', null, true)
  const lines = result.markdown.split('\n')
  assert.equal(lines[0], '前文')
  assert.equal(lines[2], '后文')
  assert.match(readFileSync(file, 'utf8'), /due=2026-10-09/)
  assert.equal(readFileSync(other, 'utf8'), '别动\n')
})
