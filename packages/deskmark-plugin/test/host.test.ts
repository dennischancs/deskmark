import assert from 'node:assert/strict'
import test from 'node:test'
import { PluginHost, authorize, createDeadline, noteInsideVault, readManifest } from '../src/index.ts'

const good = {
  id: 'wordcount',
  name: 'Word count',
  api: 1,
  entry: 'index.html',
  permissions: ['notes.read', 'ui.command', 'ui.panel']
}

test('坏清单不能当插件打开', () => {
  assert.throws(() => readManifest(null), /清单/)
  assert.throws(() => readManifest({ ...good, id: '../bad' }), /编号/)
  assert.throws(() => readManifest({ ...good, entry: '../index.html' }), /入口/)
  assert.throws(() => readManifest({ ...good, permissions: ['shell'] }), /权限/)
})

test('主版本不一致就拒绝', () => {
  assert.throws(() => readManifest({ ...good, api: 2 }), /第 2 版/)
  assert.equal(readManifest(good).id, 'wordcount')
})

test('没声明的写入会被拒绝，读当前笔记可以', () => {
  const manifest = readManifest(good)
  assert.equal(authorize(manifest, 'notes.read'), 'notes.read')
  assert.throws(() => authorize(manifest, 'notes.write'), /允许/)
  assert.throws(() => authorize(manifest, 'tasks.write'), /允许/)
  assert.equal(noteInsideVault('notes/a.md'), true)
  assert.equal(noteInsideVault('../secret.md'), false)
  assert.equal(noteInsideVault('C:/secret.md'), false)
})

test('卸载后命令消失，内置命令还在', () => {
  const host = new PluginHost()
  host.registerBuiltin({ id: 'tasks.open', title: '待办', kind: 'command', builtin: true })
  host.registerBuiltin({ id: 'calendar.open', title: '日历', kind: 'view', builtin: true })
  host.load(readManifest(good), {
    commands: [{ id: 'count', title: '字数' }],
    views: [{ id: 'panel', title: '字数' }]
  })
  assert.equal(host.commands().some(item => item.id === 'wordcount:count'), true)
  host.unload('wordcount')
  assert.equal(host.commands().some(item => item.id === 'wordcount:count'), false)
  assert.equal(host.commands().some(item => item.id === 'tasks.open'), true)
  assert.equal(host.views().some(item => item.id === 'calendar.open'), true)
})

test('超过时限就停下来，不继续做', () => {
  const deadline = createDeadline(5, Date.now() - 10)
  assert.equal(deadline.expired(), true)
  assert.throws(() => deadline.assert(), /及时/)
})
