import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { collectVaultFiles, groupTasks } from '../src/index.ts'
import type { TaskRow } from '../src/database.ts'

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
