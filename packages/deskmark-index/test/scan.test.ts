import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DEFAULT_EXTRACT_RULES } from '../../deskmark-core/src/index.ts'
import { VaultIndex } from '../src/database.ts'
import { indexTextFiles, type IndexEvent } from '../src/scan.ts'

test('大量杂文件里只索引纯文本，并且数字会往前走', async() => {
  const root = join(tmpdir(), `deskmark-scan-${Date.now()}`)
  mkdirSync(join(root, 'notes'), { recursive: true })
  mkdirSync(join(root, 'node_modules'), { recursive: true })
  for (let index = 0; index < 500; index += 1) {
    writeFileSync(join(root, `bin-${index}.png`), 'x')
  }
  writeFileSync(join(root, 'notes', 'a.md'), '- [ ] 买牛奶 <!-- deskmark: due=2026-10-08 -->\n', 'utf8')
  writeFileSync(join(root, 'notes', 'b.txt'), '不是待办\n', 'utf8')
  writeFileSync(join(root, 'node_modules', 'skip.md'), '- [ ] 隐藏\n', 'utf8')
  const events: IndexEvent[] = []
  await indexTextFiles({
    root,
    extensions: ['md', 'txt'],
    rules: DEFAULT_EXTRACT_RULES,
    times: [],
    force: false
  }, (event) => {
    events.push(event)
  }, () => false)
  const done = events.find(event => event.type === 'done')
  assert.equal(done?.type, 'done')
  if (done?.type !== 'done') return
  assert.equal(done.visited > 500, true)
  assert.deepEqual(done.paths.slice().sort(), ['notes/a.md', 'notes/b.txt'])
  const notes = events.flatMap(event => event.type === 'notes' ? event.notes : [])
  const milk = notes.find(note => note.path === 'notes/a.md')
  assert.equal(milk?.tasks[0]?.text, '买牛奶')
  assert.equal(milk?.tasks[0]?.due, '2026-10-08')
  const index = new VaultIndex(join(root, '.deskmark'))
  index.open()
  index.writePrepared(notes)
  assert.deepEqual(index.tasks().map(task => task.text), ['买牛奶'])
  index.close()
})
