import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { VaultIndex, applyExternalChange } from '../src/index.ts'

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'deskmark-index-'))
}

const milk = '- [ ] 买牛奶 <!-- deskmark: id=MILK; due=2026-10-08; priority=high -->\n'
const broken = '---\ntitle: 坏掉了\n- [ ] 还能看见\n'

test('删掉索引后能重建出同一批任务', () => {
  const directory = tempDir()
  const files = [
    { path: 'notes/b.md', content: '- [x] 后写的\n', mtimeMs: 2 },
    { path: 'notes/a.md', content: milk, mtimeMs: 1 }
  ]
  const first = new VaultIndex(directory)
  first.open()
  const report = first.rebuild(files)
  const tasks = first.tasks().map(task => `${task.notePath}:${task.text}:${task.status}`)
  first.close()

  const second = new VaultIndex(directory)
  second.open()
  second.rebuild(files)
  assert.deepEqual(second.tasks().map(task => `${task.notePath}:${task.text}:${task.status}`), tasks)
  assert.equal(report.notes, 2)
  assert.equal(report.tasks, 2)
  assert.deepEqual(second.notes().map(note => note.path), ['notes/a.md', 'notes/b.md'])
  second.close()
})

test('一篇解析失败不会挡住其他笔记', () => {
  const index = new VaultIndex(tempDir())
  index.open()
  const report = index.rebuild([
    { path: 'bad.md', content: broken, mtimeMs: 1 },
    { path: 'ok.md', content: milk, mtimeMs: 1 }
  ])
  assert.deepEqual(report.errors, [])
  assert.equal(index.notes().find(note => note.path === 'bad.md')?.parseError, 'unclosed')
  assert.equal(index.tasks().some(task => task.notePath === 'ok.md' && task.text === '买牛奶'), true)
  assert.equal(index.tasks().some(task => task.text === '还能看见'), true)
  index.close()
})

test('改一个文件只替换这一篇，外部未保存冲突时不写入', () => {
  const index = new VaultIndex(tempDir())
  index.open()
  index.rebuild([
    { path: 'a.md', content: milk, mtimeMs: 1 },
    { path: 'b.md', content: '- [ ] 别动\n', mtimeMs: 1 }
  ])
  index.upsertFile({ path: 'a.md', content: '- [ ] 换成新的\n', mtimeMs: 2 })
  assert.deepEqual(index.tasks().filter(task => task.notePath === 'a.md').map(task => task.text), ['换成新的'])
  assert.equal(index.tasks().some(task => task.text === '别动'), true)
  const conflict = applyExternalChange(index, { path: 'b.md', content: '- [ ] 被外部改了\n', mtimeMs: 3 }, new Set(['b.md']))
  assert.equal(conflict, 'conflict')
  assert.equal(index.tasks().some(task => task.text === '别动'), true)
  index.removeFile('a.md')
  assert.equal(index.tasks().some(task => task.notePath === 'a.md'), false)
  index.close()
})

test('同一个笔记文件夹不能有两个写入者，死掉的锁可以接手', () => {
  const directory = tempDir()
  const first = new VaultIndex(directory)
  first.open()
  const second = new VaultIndex(directory)
  assert.throws(() => second.open(), /另一个窗口/)
  first.close()
  writeFileSync(join(directory, 'index.lock'), '99999999')
  const third = new VaultIndex(directory)
  third.open()
  third.close()
})

test('写到一半关掉数据库会丢掉未提交的内容', () => {
  const file = join(tempDir(), 'index.sqlite')
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE notes (path TEXT)')
  db.exec('BEGIN')
  db.prepare('INSERT INTO notes (path) VALUES (?)').run('half.md')
  db.close()
  const reopened = new DatabaseSync(file)
  const row = reopened.prepare('SELECT COUNT(*) AS count FROM notes').get() as { count: number }
  assert.equal(row.count, 0)
  reopened.close()
})
