import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DEFAULT_EXTRACT_RULES } from '../../deskmark-core/src/index.ts'
import { collectVaultFiles, groupTasks, listTextFiles, prepareVaultFile, unreadableNotes } from '../src/index.ts'
import type { TaskRow } from '../src/database.ts'

test('文首没有收尾时，这篇被标出来，旁边的笔记还在', () => {
  const broken = prepareVaultFile({
    path: 'notes/broken.md',
    content: '---\ntitle: 坏了\n\n正文\n',
    mtimeMs: 1
  }, DEFAULT_EXTRACT_RULES)
  assert.equal(broken.parseError, 'unclosed')
  assert.equal(broken.failed, false)
  assert.deepEqual(unreadableNotes([
    { path: broken.path, parseError: broken.parseError },
    { path: 'notes/ok.md', parseError: null }
  ]), [{ path: 'notes/broken.md' }])
})

test('收集笔记时跳过索引目录', () => {
  const root = join(tmpdir(), `deskmark-vault-${Date.now()}`)
  mkdirSync(join(root, 'notes'), { recursive: true })
  mkdirSync(join(root, '.deskmark'), { recursive: true })
  writeFileSync(join(root, 'notes', 'a.md'), '- [ ] 甲\n', 'utf8')
  writeFileSync(join(root, '.deskmark', 'hidden.md'), '- [ ] 隐藏\n', 'utf8')
  writeFileSync(join(root, 'notes', 'b.txt'), '不是 markdown', 'utf8')
  assert.deepEqual(collectVaultFiles(root).map(file => file.path), ['notes/a.md'])
  assert.deepEqual(collectVaultFiles(root, ['md', 'txt']).map(file => file.path), ['notes/a.md', 'notes/b.txt'])
})

test('按扩展名往下找，并跳过 node_modules', async() => {
  const root = join(tmpdir(), `deskmark-walk-${Date.now()}`)
  mkdirSync(join(root, 'notes'), { recursive: true })
  mkdirSync(join(root, 'node_modules'), { recursive: true })
  writeFileSync(join(root, 'notes', 'a.md'), '- [ ] 甲\n', 'utf8')
  writeFileSync(join(root, 'b.txt'), '乙\n', 'utf8')
  writeFileSync(join(root, 'node_modules', 'c.md'), '- [ ] 隐藏\n', 'utf8')
  const found: string[] = []
  const seen = await listTextFiles(root, ['md', 'txt'], () => false, (file) => {
    found.push(file.path)
  })
  assert.equal(seen, 2)
  assert.deepEqual(found.sort(), ['b.txt', 'notes/a.md'])
})

test('一个目录里有很多别的文件时，仍然能找到纯文本', async() => {
  const root = join(tmpdir(), `deskmark-wide-${Date.now()}`)
  mkdirSync(root)
  for (let index = 0; index < 450; index += 1) {
    writeFileSync(join(root, `bin-${index}.png`), 'x')
  }
  writeFileSync(join(root, 'note.md'), '- [ ] 甲\n', 'utf8')
  const found: string[] = []
  const seen = await listTextFiles(root, ['md'], () => false, (file) => {
    found.push(file.path)
  })
  assert.equal(seen, 1)
  assert.deepEqual(found, ['note.md'])
})

test('待办按分组放好', () => {
  const now = new Date('2026-10-06T01:00:00.000Z')
  const row = (text: string, due: string | null, status: 'open' | 'done'): TaskRow => ({
    taskKey: text,
    notePath: 'a.md',
    line: 1,
    text,
    status,
    due,
    remindAt: null,
    priority: 'normal',
    repeat: 'none',
    completedAt: null,
    raw: text,
    source: 'inline'
  })
  const groups = groupTasks([
    row('逾期', '2026-10-05', 'open'),
    row('今天', '2026-10-06', 'open'),
    row('以后', '2026-10-20', 'open'),
    row('没有日期', null, 'open'),
    row('完成', '2026-10-05', 'done')
  ], now, 'Asia/Shanghai')
  assert.deepEqual(groups.overdue.map(task => task.text), ['逾期'])
  assert.deepEqual(groups.today.map(task => task.text), ['今天'])
  assert.deepEqual(groups.upcoming.map(task => task.text), ['以后'])
  assert.deepEqual(groups.inbox.map(task => task.text), ['没有日期'])
  assert.deepEqual(groups.done.map(task => task.text), ['完成'])
})

test('同一组里高优先级排在前面', () => {
  const now = new Date('2026-10-06T01:00:00.000Z')
  const row = (text: string, priority: string): TaskRow => ({
    taskKey: text,
    notePath: 'a.md',
    line: 1,
    text,
    status: 'open',
    due: null,
    remindAt: null,
    priority,
    repeat: 'none',
    completedAt: null,
    raw: text,
    source: 'inline'
  })
  const groups = groupTasks([
    row('低', 'low'),
    row('高', 'high'),
    row('普通', 'normal')
  ], now, 'Asia/Shanghai')
  assert.deepEqual(groups.inbox.map(task => task.text), ['高', '普通', '低'])
})
