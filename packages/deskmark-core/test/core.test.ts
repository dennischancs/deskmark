import assert from 'node:assert/strict'
import test from 'node:test'
import { addMonths } from '../src/time.ts'
import {
  agendaFromMarkdown,
  applyTaskEdit,
  appendJournalTask,
  agendaCounts,
  bridgeForDay,
  calendarGroup,
  DEADLINE_WARNING_DAYS,
  tasksForAgenda,
  completeInlineTask,
  completeNote,
  idQueue,
  journalPath,
  localDateTimeToIso,
  markedDates,
  moveDueToDay,
  parseNote,
  previewTasks,
  smartList,
  filterTasks,
  sortTasks,
  tasksOnDate,
  updateInlineTask
} from '../src/index.ts'

const weekly = [
  '---',
  'title: 买东西',
  'custom: keep-me',
  'deskmark:',
  '  id: NOTE',
  '  kind: note',
  '---',
  '',
  '- [ ] 买牛奶 <!-- deskmark: id=OLD; due=2026-10-08; remind=2026-10-08T09:00:00+08:00; priority=high; repeat=weekly; vendor=keep -->',
  '- [x] 已做的事 <!-- deskmark: id=DONE; completed=2026-10-06T18:02:00+08:00 -->',
  ''
].join('\n')

test('打开文件不会改写，未知键还在', () => {
  const parsed = parseNote(weekly, 'notes/a.md')
  assert.equal(parsed.title, '买东西')
  assert.equal(parsed.fields.kind, 'note')
  assert.equal(parsed.tasks[0].text, '买牛奶')
  assert.equal(parsed.tasks[0].unknown[0].key, 'vendor')
  assert.equal(parsed.tasks[0].id, 'OLD')
  assert.equal(parsed.tasks[1].checked, true)
  assert.match(parsed.tasks[0].temporaryKey, /^notes\/a.md#/)
})

test('只改截止日期时，其他字节里的未知键还在', () => {
  const result = updateInlineTask(weekly, 9, { due: '2026-10-09' }, idQueue(['UNUSED']))
  assert.equal(result.changed, true)
  assert.match(result.markdown, /custom: keep-me/)
  assert.match(result.markdown, /due=2026-10-09/)
  assert.match(result.markdown, /vendor=keep/)
  assert.match(result.markdown, /id=OLD/)
  assert.doesNotMatch(result.markdown, /UNUSED/)
})

test('完成每周任务会留下原行，并插入下一次', () => {
  const now = new Date('2026-10-06T10:00:00.000Z')
  const result = completeInlineTask(weekly, 9, now, 'Asia/Shanghai', idQueue(['NEXT']))
  assert.equal(result.advanced, true)
  const lines = result.markdown.split('\n')
  assert.match(lines[8], /^- \[x\] 买牛奶 <!-- deskmark: id=OLD; due=2026-10-08; remind=2026-10-08T09:00:00\+08:00; priority=high; repeat=weekly; completed=2026-10-06T18:00:00\+08:00; vendor=keep -->$/)
  assert.match(lines[9], /^- \[ \] 买牛奶 <!-- deskmark: id=NEXT; due=2026-10-15; remind=2026-10-15T09:00:00\+08:00; priority=high; repeat=weekly; vendor=keep -->$/)
})

test('不认识的重复规则原样留下，完成时不往后推', () => {
  const markdown = '- [ ] 春季整理 <!-- deskmark: id=OLD; due=2026-10-08; repeat=every-spring -->\n'
  const result = completeInlineTask(markdown, 1, new Date('2026-10-06T10:00:00.000Z'), 'Asia/Shanghai', idQueue(['NO']))
  assert.equal(result.advanced, false)
  assert.equal(result.unsupportedRepeat, true)
  assert.match(result.markdown, /repeat=every-spring/)
  assert.doesNotMatch(result.markdown, /id=NO/)
  assert.equal(result.markdown.split('\n').filter(line => line.startsWith('- [')).length, 1)
})

test('坏掉的 front matter 不挡住正文里的待办', () => {
  const markdown = '---\ntitle: 没有结尾\n- [ ] 仍然是待办\n'
  const parsed = parseNote(markdown, 'bad.md')
  assert.equal(parsed.frontMatterError, 'unclosed')
  assert.equal(parsed.tasks.length, 1)
  assert.equal(parsed.tasks[0].text, '仍然是待办')
})

test('代码块里的勾选框不是待办', () => {
  const markdown = '```\n- [ ] 不是\n```\n\n- [ ] 是\n'
  assert.deepEqual(parseNote(markdown).tasks.map(task => task.text), ['是'])
})

test('每月跨月截到当月最后一天', () => {
  assert.deepEqual(addMonths({ y: 2026, m: 1, d: 31 }, 1), { y: 2026, m: 2, d: 28 })
  assert.deepEqual(addMonths({ y: 2024, m: 1, d: 31 }, 1), { y: 2024, m: 2, d: 29 })
  const note = [
    '---',
    'title: 交房租',
    'deskmark:',
    '  id: NOTE',
    '  kind: todo',
    '  due: 2026-01-31',
    '  remind: 2026-01-31T09:00:00+08:00',
    '  repeat: monthly',
    '  extra: stay',
    '---',
    '',
    '说明',
    ''
  ].join('\n')
  const result = completeNote(note, new Date('2026-01-31T01:00:00.000Z'), 'Asia/Shanghai', idQueue(['NO']))
  assert.equal(result.advanced, true)
  assert.match(result.markdown, /due: 2026-02-28/)
  assert.match(result.markdown, /remind: 2026-02-28T09:00:00\+08:00/)
  assert.match(result.markdown, /extra: stay/)
  assert.doesNotMatch(result.markdown, /status: done/)
  assert.match(result.markdown, /## 完成记录/)
  assert.match(result.markdown, /- 2026-01-31T09:00:00\+08:00/)
})

test('整篇待办遇到不认识的重复规则时不推进', () => {
  const note = '---\ndeskmark:\n  kind: todo\n  due: 2026-10-08\n  repeat: FREQ=WEEKLY;INTERVAL=2\n---\n\n正文\n'
  const result = completeNote(note, new Date('2026-10-06T10:00:00.000Z'), 'Asia/Shanghai', idQueue(['ID1']))
  assert.equal(result.unsupportedRepeat, true)
  assert.equal(result.advanced, false)
  assert.match(result.markdown, /repeat: FREQ=WEEKLY;INTERVAL=2/)
  assert.match(result.markdown, /due: 2026-10-08/)
  assert.match(result.markdown, /status: done/)
})

test('日历分组按本地时区，同一天带时间的过点算逾期', () => {
  const now = new Date('2026-10-06T01:00:00.000Z')
  const zone = 'Asia/Shanghai'
  const samples = [
    { done: false, due: '2026-10-05' },
    { done: false, due: '2026-10-06' },
    { done: false, due: '2026-10-06T08:00:00+08:00' },
    { done: false, due: '2026-10-06T18:00:00+08:00' },
    { done: false, due: '2026-10-08' },
    { done: false, due: '2026-10-20' },
    { done: false, due: null },
    { done: true, due: '2026-10-05' }
  ]
  assert.deepEqual(samples.map(item => calendarGroup(item, now, zone)), [
    'overdue', 'today', 'overdue', 'today', 'next7', 'later', 'undated', 'today'
  ])
  assert.deepEqual(samples.map(item => smartList(item, now, zone)), [
    'overdue', 'today', 'overdue', 'today', 'upcoming', 'upcoming', 'inbox', 'done'
  ])
  const named = samples.map((item, index) => ({ ...item, text: String(index) }))
  assert.deepEqual(agendaCounts(named, now, zone), { overdue: 2, today: 2, next7: 1, later: 1, undated: 1 })
  assert.deepEqual(tasksForAgenda(named, { kind: 'group', group: 'next7' }, now, zone).map(item => item.due), ['2026-10-08'])
  assert.deepEqual(tasksForAgenda(named, { kind: 'day', day: '2026-10-05' }, now, zone).map(item => item.text), ['0', '7'])
})

test('今天的日历把逾期、近几天和未定日期接在同一天，别的日子也能接上逾期', () => {
  const now = new Date('2026-10-06T01:00:00.000Z')
  const zone = 'Asia/Shanghai'
  const items = [
    { done: false, due: '2026-10-05', text: '逾期低', priority: 'low' },
    { done: false, due: '2026-10-04', text: '逾期高', priority: 'high' },
    { done: false, due: '2026-10-06', text: '今天', priority: 'normal' },
    { done: false, due: '2026-10-06T18:00:00+08:00', text: '今晚', priority: 'normal' },
    { done: false, due: '2026-10-08', text: '快到了', priority: 'normal' },
    { done: false, due: '2026-10-20', text: '更晚', priority: 'normal' },
    { done: false, due: null, text: '没收拾', priority: 'normal' },
    { done: true, due: '2026-10-05', text: '做过了', priority: 'high' },
    { done: true, due: null, text: '完成且无日期', priority: 'normal' },
    { done: true, due: '2026-10-06', text: '当天做完', priority: 'normal', completed: '2026-10-06T03:00:00+08:00' },
    { done: true, due: '2026-10-02', text: '更早做完', priority: 'normal', completed: '2026-10-06T04:00:00+08:00' },
    { done: true, due: '2026-10-01', text: '提前做完', priority: 'low', completed: '2026-10-06T08:00:00+08:00' }
  ]
  const today = bridgeForDay(items, '2026-10-06', now, zone)
  assert.equal(DEADLINE_WARNING_DAYS, 3)
  assert.deepEqual(today.onDay.map(item => item.text), ['今晚', '今天', '当天做完'])
  assert.deepEqual(today.carried.map(item => item.text), ['逾期高', '逾期低'])
  assert.deepEqual(today.soon.map(item => item.text), ['快到了'])
  assert.deepEqual(today.undated.map(item => item.text), ['没收拾'])
  assert.deepEqual(today.finished.map(item => item.text), ['更早做完', '提前做完'])
  const past = bridgeForDay(items, '2026-10-05', now, zone)
  assert.deepEqual(past.onDay.map(item => item.text), ['逾期低', '做过了'])
  assert.deepEqual(past.carried.map(item => item.text), ['逾期高'])
  assert.deepEqual(past.soon, [])
  assert.deepEqual(past.finished, [])
  assert.deepEqual(past.undated.map(item => item.text), ['没收拾'])
  const future = bridgeForDay(items, '2026-10-09', now, zone)
  assert.deepEqual(future.onDay, [])
  assert.deepEqual(future.carried.map(item => item.text), ['逾期高', '逾期低'])
  assert.deepEqual(future.soon, [])
})

test('月历一格只预览这一天还没做完的待办', () => {
  const items = [
    { done: false, due: '2026-10-08', text: '低', priority: 'low' },
    { done: false, due: '2026-10-08', text: '高', priority: 'high' },
    { done: false, due: '2026-10-08T09:00:00+08:00', text: '钟点', priority: 'normal' },
    { done: true, due: '2026-10-08', text: '做过', priority: 'high' },
    { done: false, due: '2026-10-09', text: '另一天', priority: 'normal' }
  ]
  const preview = previewTasks(items, '2026-10-08', 2)
  assert.deepEqual(preview.shown.map(item => item.text), ['高', '钟点'])
  assert.equal(preview.extra, 1)
  assert.equal(previewTasks(items, '2026-10-09').shown.length, 1)
  assert.equal(previewTasks(items, '2026-10-07').extra, 0)
})

test('把待办放到某一天只改原来的日期，不另起一行', () => {
  assert.equal(moveDueToDay(null, '2026-10-08'), '2026-10-08')
  assert.equal(moveDueToDay('2026-10-01', '2026-10-08'), '2026-10-08')
  assert.equal(moveDueToDay('2026-10-01T09:00:00+08:00', '2026-10-08'), '2026-10-08T09:00:00+08:00')
  assert.equal(moveDueToDay('2026-10-01', '明天'), null)
  const source = '- [ ] 买牛奶 <!-- deskmark: id=A; due=2026-10-01; priority=high -->\n'
  const moved = applyTaskEdit(source, 1, { due: moveDueToDay('2026-10-01', '2026-10-08') }, new Date('2026-10-06T01:00:00.000Z'), 'Asia/Shanghai')
  assert.equal(moved.changed, true)
  assert.match(moved.markdown, /买牛奶/)
  assert.match(moved.markdown, /due=2026-10-08/)
  assert.match(moved.markdown, /priority=high/)
  assert.equal(moved.markdown.match(/^- \[ \]/gm)?.length, 1)
  const cleared = applyTaskEdit(moved.markdown, 1, { due: null }, new Date('2026-10-06T01:00:00.000Z'), 'Asia/Shanghai')
  assert.doesNotMatch(cleared.markdown, /due=/)
  assert.match(cleared.markdown, /priority=high/)
})

test('全库待办按日期出现，完成的不在月历标记里', () => {
  const markdown = [
    '- [ ] 牛奶 <!-- deskmark: due=2026-10-08 -->',
    '- [x] 面包 <!-- deskmark: due=2026-10-08 -->',
    '- [ ] 以后 <!-- deskmark: due=2026-10-20 -->',
    ''
  ].join('\n')
  const items = agendaFromMarkdown('notes/a.md', markdown)
  assert.deepEqual(tasksOnDate(items, '2026-10-08').map(item => item.text), ['牛奶', '面包'])
  assert.deepEqual(markedDates(items), ['2026-10-08', '2026-10-20'])
})

test('换行混在一起时，待办行仍然能被认出来', () => {
  const markdown = '# 手测\n\n- [ ] 买牛奶 <!-- deskmark: id=hand722; due=2026-10-07; priority=high -->\n- [ ] 写信 a@b.com\r\n'
  const items = agendaFromMarkdown('notes/milk.md', markdown)
  assert.deepEqual(items.map(item => item.text), ['买牛奶', '写信 a@b.com'])
  assert.equal(items[0]?.due, '2026-10-07')
  assert.equal(items[0]?.priority, 'high')
})

test('从日历新建落在日记的一行', () => {
  assert.equal(journalPath('2026-10-08'), 'journal/2026-10-08.md')
  const created = appendJournalTask(null, '交表', '2026-10-08', 'NEW')
  assert.match(created, /kind: note/)
  assert.match(created, /^- \[ \] 交表 <!-- deskmark: id=NEW; due=2026-10-08 -->$/m)
  const again = appendJournalTask(created, '再补一条', '2026-10-08', 'NEW2')
  assert.equal(again.match(/^- \[ \]/gm)?.length, 2)
  assert.equal(again.match(/deskmark:/g)?.length, 3)
})

test('给一行设日期和提醒时，其他行不变', () => {
  const markdown = [
    '前文',
    '- [ ] 买牛奶',
    '后文',
    ''
  ].join('\n')
  const result = applyTaskEdit(markdown, 2, {
    due: '2026-10-09',
    remind: '2026-10-09T09:00:00+08:00'
  }, new Date('2026-10-06T01:00:00.000Z'), 'Asia/Shanghai', idQueue(['ID']))
  const lines = result.markdown.split('\n')
  assert.equal(lines[0], '前文')
  assert.equal(lines[2], '后文')
  assert.match(lines[1], /^- \[ \] 买牛奶 <!-- deskmark: id=ID; due=2026-10-09; remind=2026-10-09T09:00:00\+08:00 -->$/)
})

test('勾选普通待办只改方括号', () => {
  const markdown = '保持\n- [ ] 买牛奶\n保持\n'
  const result = applyTaskEdit(markdown, 2, { checked: true }, new Date('2026-10-06T10:00:00.000Z'), 'Asia/Shanghai', idQueue(['NO']))
  assert.equal(result.advanced, false)
  assert.match(result.markdown, /^保持\n- \[x\] 买牛奶\n保持\n$/)
})

test('本地时间 9 点写成带时区的提醒', () => {
  assert.equal(localDateTimeToIso('2026-10-09T09:00', 'Asia/Shanghai'), '2026-10-09T09:00:00+08:00')
})

test('待办可以按字搜索，并按日期或标题重排', () => {
  const items = [
    { done: false, due: '2026-10-20', text: 'zeta', priority: 'low', notePath: 'notes/a.md' },
    { done: false, due: '2026-10-08', text: '买牛奶', priority: 'high', notePath: 'notes/milk.md' },
    { done: false, due: null, text: 'alpha', priority: 'normal', notePath: 'notes/b.md' }
  ]
  assert.deepEqual(filterTasks(items, ' 牛奶 ').map(item => item.text), ['买牛奶'])
  assert.deepEqual(filterTasks(items, 'MILK').map(item => item.text), ['买牛奶'])
  assert.deepEqual(sortTasks(items, 'priority').map(item => item.text), ['买牛奶', 'alpha', 'zeta'])
  assert.deepEqual(sortTasks(items, 'due').map(item => item.text), ['买牛奶', 'zeta', 'alpha'])
  assert.deepEqual(sortTasks(items, 'title').map(item => item.text), ['alpha', 'zeta', '买牛奶'])
  const renamed = applyTaskEdit('- [ ] 买牛奶 <!-- deskmark: id=A; due=2026-10-08; priority=high -->\n', 1, { text: '买面包' }, new Date('2026-10-06T01:00:00.000Z'), 'Asia/Shanghai')
  assert.match(renamed.markdown, /买面包/)
  assert.match(renamed.markdown, /due=2026-10-08/)
  assert.match(renamed.markdown, /priority=high/)
  assert.equal(renamed.markdown.match(/^- \[ \]/gm)?.length, 1)
})
