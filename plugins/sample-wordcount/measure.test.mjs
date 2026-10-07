import assert from 'node:assert/strict'
import test from 'node:test'
import { copyFor, measureText, prefersCharacters, presentNote } from './measure.mjs'

test('中文按字数，英文按词', () => {
  assert.deepEqual(measureText('买牛奶'), { chars: 3, words: 3, lines: 1 })
  assert.deepEqual(measureText('alpha beta'), { chars: 9, words: 2, lines: 1 })
  assert.deepEqual(measureText('hello 世界'), { chars: 7, words: 3, lines: 1 })
  assert.deepEqual(measureText('a\r\nb\n'), { chars: 2, words: 2, lines: 2 })
  assert.deepEqual(measureText(''), { chars: 0, words: 0, lines: 0 })
})

test('中日韩用字符当主数字', () => {
  assert.equal(prefersCharacters('zh-CN'), true)
  assert.equal(prefersCharacters('ja'), true)
  assert.equal(prefersCharacters('en-US'), false)
  assert.equal(copyFor('zh-TW').chars, '字元')
  assert.equal(copyFor('zh-HK').chars, '字元')
  assert.equal(copyFor('fr').words, 'Mots')
  assert.equal(copyFor('zz').words, 'Words')
})

test('没有打开笔记时不显示 0', () => {
  const empty = presentNote({ lang: 'zh-CN', state: 'empty' })
  assert.equal(empty.value, '-')
  assert.match(empty.hint, /打开一篇笔记/)
  const ready = presentNote({ markdown: '买牛奶', path: 'notes/milk.md', lang: 'zh-CN', state: 'ready' })
  assert.equal(ready.value, '3')
  assert.equal(ready.unit, '字符')
  assert.equal(ready.path, 'milk.md')
  assert.equal(ready.rows[1].value, '3')
})
