import assert from 'node:assert/strict'
import test from 'node:test'
import { applyQuickAction, buildMonth, planReminders, shouldOpenAtMention } from '../src/index.ts'

test('月历标出有事的日期，周一开头', () => {
  const cells = buildMonth(2026, 10, ['2026-10-08'])
  assert.equal(cells[0].date, null)
  assert.equal(cells[3].date, '2026-10-01')
  assert.equal(cells.find(cell => cell.date === '2026-10-08')?.marked, true)
  assert.equal(cells.find(cell => cell.date === '2026-10-07')?.marked, false)
  assert.equal(cells.length % 7, 0)
})

test('邮箱中间的 @ 不打开，行首和空格后的 @ 打开', () => {
  assert.equal(shouldOpenAtMention('a@b.com'), false)
  assert.equal(shouldOpenAtMention('@今天'), true)
  assert.equal(shouldOpenAtMention('买牛奶 @明天'), true)
})

test('斜杠动作留在当前行，日记只是链接', () => {
  const dated = applyQuickAction('/date', 'date', {
    today: '2026-10-06',
    tomorrow: '2026-10-07',
    remind: '2026-10-06T09:00:00+08:00',
    journalHref: 'journal/2026-10-06.md',
    id: 'ID'
  })
  assert.equal(dated.asTask, true)
  assert.match(dated.text, /due=2026-10-06/)
  const journal = applyQuickAction('/journal', 'journal', {
    today: '2026-10-06',
    tomorrow: '2026-10-07',
    remind: '2026-10-06T09:00:00+08:00',
    journalHref: 'journal/2026-10-06.md',
    id: 'ID'
  })
  assert.equal(journal.asTask, false)
  assert.equal(journal.text, '[2026-10-06](journal/2026-10-06.md)')
})

test('错过的提醒只汇总一次，刚到点的单独通知', () => {
  const now = new Date('2026-10-06T01:00:30.000Z')
  const tasks = [
    { id: 'now', text: '刚到', remind: '2026-10-06T09:00:00+08:00', done: false, path: 'a.md', line: 1 },
    { id: 'old', text: '早过了', remind: '2026-10-05T09:00:00+08:00', done: false, path: 'a.md', line: 2 },
    { id: 'later', text: '还没到', remind: '2026-10-06T18:00:00+08:00', done: false, path: 'a.md', line: 3 }
  ]
  const first = planReminders({ tasks, now, timeZone: 'Asia/Shanghai', fired: [], summaryDay: null })
  assert.deepEqual(first.notify.map(task => task.id), ['now'])
  assert.equal(first.summary, 1)
  const second = planReminders({ tasks, now, timeZone: 'Asia/Shanghai', fired: first.fired, summaryDay: first.summaryDay })
  assert.deepEqual(second.notify, [])
  assert.equal(second.summary, null)
})
