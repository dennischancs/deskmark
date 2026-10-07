import assert from 'node:assert/strict'
import test from 'node:test'
import { agendaForIndex, DEFAULT_EXTRACT_RULES } from '../src/extract.ts'

const note = [
  '---',
  'title: 交表',
  'deskmark:',
  '  kind: todo',
  '  due: 2026-10-09',
  '---',
  '',
  '- [ ] 买牛奶 <!-- deskmark: due=2026-10-08; priority=high -->',
  'TODO: 回信 2026-10-11',
  '```',
  'TODO: 代码里的不算',
  '```',
  ''
].join('\n')

test('默认规则只认任务行和文首待办，不从正文里抓日期', () => {
  const items = agendaForIndex('notes/a.md', note)
  assert.deepEqual(items.map(item => item.text), ['交表', '买牛奶'])
  assert.equal(items[1].due, '2026-10-08')
})

test('关掉注释后，任务还在，但日期和优先级不再从注释来', () => {
  const items = agendaForIndex('notes/a.md', note, { ...DEFAULT_EXTRACT_RULES, commentMeta: false })
  const task = items.find(item => item.text === '买牛奶')
  assert.equal(task?.due, null)
  assert.equal(task?.priority, 'normal')
})

test('额外开头和正文里的日期可以单独打开', () => {
  const items = agendaForIndex('notes/a.md', note, {
    ...DEFAULT_EXTRACT_RULES,
    taskLine: false,
    frontMatter: false,
    dateInText: true,
    extraPrefixes: ['TODO:']
  })
  assert.deepEqual(items.map(item => `${item.text}:${item.due}`), ['回信 2026-10-11:2026-10-11'])
})
