import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  CLEAN_RELATIVE_PATHS,
  cleanWorkspace,
  parseArgs,
  releaseScriptName,
  releaseTarget,
  resolveInside
} from './workspace.ts'

test('maps the host to the existing package script', () => {
  assert.equal(releaseTarget('win32'), 'win')
  assert.equal(releaseTarget('darwin'), 'mac')
  assert.equal(releaseTarget('linux'), 'linux')
  assert.equal(releaseTarget('aix'), null)
  assert.equal(releaseScriptName('win', 'x64', false), 'build:win')
  assert.equal(releaseScriptName('win', 'arm64', false), 'build:win:arm64')
  assert.equal(releaseScriptName('mac', 'arm64', false), 'build:mac')
  assert.equal(releaseScriptName('linux', 'x64', false), 'build:linux')
  assert.equal(releaseScriptName('win', 'x64', true), 'build:unpack')
})

test('rejects options that are not part of the script', () => {
  assert.deepEqual(parseArgs(['rebuild', '--unpack']), { command: 'rebuild', unpack: true, installers: false })
  assert.deepEqual(parseArgs(['clean', '--installers']), { command: 'clean', unpack: false, installers: true })
  assert.throws(() => parseArgs(['clean', '--unpack']))
  assert.throws(() => parseArgs(['build', '--installers']))
  assert.throws(() => parseArgs(['ship']))
})

test('clean stays inside the repository and removes only generated output', () => {
  assert.equal(CLEAN_RELATIVE_PATHS.includes('dist'), false)
  assert.ok(CLEAN_RELATIVE_PATHS.includes('packages/desktop/out'))
  assert.equal(CLEAN_RELATIVE_PATHS.some(item => item.includes('node_modules')), false)
  assert.throws(() => resolveInside(path.join(tmpdir(), 'deskmark-root'), '../outside'))

  const root = mkdtempSync(path.join(tmpdir(), 'deskmark-clean-'))
  try {
    const out = path.join(root, 'packages', 'desktop', 'out')
    const locale = path.join(root, 'packages', 'desktop', 'static', 'locales')
    mkdirSync(out, { recursive: true })
    mkdirSync(locale, { recursive: true })
    mkdirSync(path.join(root, 'dist', 'win-unpacked'), { recursive: true })
    mkdirSync(path.join(root, 'logs'), { recursive: true })
    writeFileSync(path.join(out, 'main.js'), 'built')
    writeFileSync(path.join(locale, 'en.min.json'), '{}')
    writeFileSync(path.join(locale, 'en.json'), '{"keep":true}')
    writeFileSync(path.join(root, 'dist', 'win-unpacked', 'marktext.exe'), 'app')
    writeFileSync(path.join(root, 'dist', 'latest.yml'), 'version: 1')
    writeFileSync(path.join(root, 'dist', 'marktext-win-x64-7.14.0-setup.exe'), 'installer')
    writeFileSync(path.join(root, 'logs', 'main.log'), 'log')
    writeFileSync(path.join(root, 'probe.log'), 'log')
    const removed = cleanWorkspace(root)
    assert.ok(removed.includes('packages/desktop/out'))
    assert.ok(removed.includes('packages/desktop/static/locales/en.min.json'))
    assert.equal(removed.includes('packages/desktop/static/locales/en.json'), false)
    assert.ok(removed.includes('dist/win-unpacked'))
    assert.ok(removed.includes('dist/latest.yml'))
    assert.ok(removed.includes('logs'))
    assert.ok(removed.includes('probe.log'))
    assert.equal(existsSync(path.join(root, 'dist', 'marktext-win-x64-7.14.0-setup.exe')), true)
    const wiped = cleanWorkspace(root, true)
    assert.ok(wiped.includes('dist'))
    assert.equal(existsSync(path.join(root, 'dist')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
