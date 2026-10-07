import assert from 'node:assert/strict'
import test from 'node:test'
import { PluginHost, answerPluginCall, authorize, createDeadline, noteInsideVault, readManifest } from '../src/index.ts'

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

test('没有设置权限就不能登记设置页', () => {
  const host = new PluginHost()
  assert.throws(() => host.load(readManifest(good), {
    settings: [{ id: 'panel', title: '字数' }]
  }), /允许/)
  const manifest = readManifest({ ...good, permissions: [...good.permissions, 'settings'] })
  host.load(manifest, { settings: [{ id: 'panel', title: '字数' }] })
  assert.equal(host.settings().some(item => item.id === 'wordcount:panel' && item.kind === 'settings'), true)
  host.unload('wordcount')
  assert.equal(host.settings().some(item => item.id === 'wordcount:panel'), false)
})

test('超过时限就停下来，不继续做', () => {
  const deadline = createDeadline(5, Date.now() - 10)
  assert.equal(deadline.expired(), true)
  assert.throws(() => deadline.assert(), /及时/)
})

test('主进程只把当前笔记交给已允许的读取，外面的路径读不到', () => {
  const manifest = readManifest(good)
  const snapshot = { vault: 'D:/notes', path: 'a.md', markdown: '两个词' }
  const ok = answerPluginCall({
    manifest,
    call: { id: '1', method: 'notes.read' },
    snapshot,
    readVaultFile: () => null
  })
  assert.equal(ok.ok, true)
  assert.equal((ok.result as { markdown: string }).markdown, '两个词')
  const outside = answerPluginCall({
    manifest,
    call: { id: '2', method: 'notes.read', path: '../secret.md' },
    snapshot,
    readVaultFile: () => '秘密'
  })
  assert.equal(outside.ok, false)
  const write = answerPluginCall({
    manifest,
    call: { id: '3', method: 'notes.write', path: 'a.md' },
    snapshot,
    readVaultFile: () => null
  })
  assert.equal(write.ok, false)
})

test('即使声明了写入，现在也不会假装已经写上', () => {
  const manifest = readManifest({ ...good, permissions: ['notes.write', 'tasks.write'] })
  const note = answerPluginCall({
    manifest,
    call: { id: '9', method: 'notes.write', path: 'a.md' },
    snapshot: { vault: 'D:/notes', path: 'a.md', markdown: '原来' },
    readVaultFile: () => '原来'
  })
  const task = answerPluginCall({
    manifest,
    call: { id: '10', method: 'tasks.write' },
    snapshot: null,
    readVaultFile: () => null
  })
  assert.equal(note.ok, false)
  assert.match(note.error ?? '', /写入/)
  assert.equal(task.ok, false)
})

test('声明了任务读取才返回待办，库外路径不出现', () => {
  const manifest = readManifest({ ...good, permissions: ['tasks.read'] })
  const result = answerPluginCall({
    manifest,
    call: { id: '4', method: 'tasks.read' },
    snapshot: null,
    readVaultFile: () => null,
    tasks: [
      { text: '买牛奶', path: 'notes/a.md', line: 3, due: '2026-10-08', done: false },
      { text: '秘密', path: '../secret.md', line: 1, due: null, done: false }
    ]
  })
  assert.equal(result.ok, true)
  const tasks = (result.result as { tasks: Array<{ text: string }> }).tasks
  assert.deepEqual(tasks.map(task => task.text), ['买牛奶'])
  assert.throws(() => authorize(readManifest(good), 'tasks.read'), /允许/)
})
