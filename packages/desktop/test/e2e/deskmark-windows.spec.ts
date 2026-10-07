import { expect, test } from '@playwright/test'
import { _electron, type ElectronApplication, type Page } from 'playwright'
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron, launchWithMarkdown, removeTree, sendIpcToRenderer } from './helpers'

const stopApp = (app: ElectronApplication): void => {
  let pid: number | undefined
  try {
    pid = app.process().pid
  } catch {
    return
  }
  if (!pid) return
  try {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' })
  } catch {
    try {
      process.kill(pid)
    } catch {
      // The process already exited.
    }
  }
}

const openedNames = (page: Page): Promise<string[]> =>
  page.locator('.opened-file .name').allTextContents()

const pageWith = async(app: ElectronApplication, selector: string): Promise<Page> => {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    for (const candidate of app.windows()) {
      if (await candidate.locator(selector).count() > 0) return candidate
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`no window matched ${selector}`)
}

// The quick-insert node is always in the document. Hidden, it sits at
// top/left -9999, so a locator that merely finds "待办" does not prove the
// menu is on screen.

const menuOnScreen = async(page: Page): Promise<void> => {
  const menu = page.locator('.mu-quick-insert')
  await expect.poll(async() => {
    const box = await menu.boundingBox()
    if (!box) return false
    return box.y >= 0 && box.x >= 0 && box.height > 20
  }, { timeout: 8000 }).toBe(true)
  await expect(menu.locator('[data-label="deskmark:todo"]')).toBeVisible()
}

test('typing slash on an empty line opens the insert menu on screen', async() => {
  test.setTimeout(45000)
  const launched = await launchWithMarkdown('# Hello\n\n\n', {
    preferences: { language: 'en' }
  })
  const { app, page } = launched
  try {
    await page.locator('h1.mu-atx-heading').click({ timeout: 5000 })
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/')
    await menuOnScreen(page)
  } finally {
    stopApp(app)
  }
})

test('both tray buttons open a menu with a new file, tasks, the calendar, and a sticky note', async() => {
  test.setTimeout(45000)
  const launched = await launchElectron([], {
    preferences: { language: 'zh-CN' },
    env: { DESKMARK_E2E: '1' }
  })
  const { app } = launched
  try {
    await expect.poll(async() => app.evaluate(() => {
      const hook = (global as { __deskmarkTray?: { labels?: string[] } }).__deskmarkTray
      return hook?.labels?.join('|') || ''
    }), { timeout: 10000 }).toContain('新建文件')
    const hook = await app.evaluate(() => {
      return (global as {
        __deskmarkTray?: { labels: string[], click: number, rightClick: number }
      }).__deskmarkTray
    })
    expect(hook?.labels).toEqual(['新建文件', '待办', '日历', '便签', '显示桌笺', '登录时打开', '退出'])
    expect(hook?.click).toBeGreaterThan(0)
    expect(hook?.rightClick).toBeGreaterThan(0)
  } finally {
    stopApp(app)
  }
})

test('closing the main window keeps the tray process', async() => {
  test.setTimeout(45000)
  const launched = await launchElectron([], { preferences: { language: 'zh-CN' } })
  const { app } = launched
  try {
    await expect.poll(async() => app.evaluate(({ BrowserWindow }) => {
      return BrowserWindow.getAllWindows().some(win => win.isVisible())
    }), { timeout: 10000 }).toBe(true)
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find(item => item.isVisible())
      win?.close()
    })
    await expect.poll(async() => app.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows()
      return windows.length > 0 && windows.every(win => !win.isVisible())
    }), { timeout: 8000 }).toBe(true)
  } finally {
    stopApp(app)
  }
})

test('the installed program keeps running after the main window closes', async() => {
  test.setTimeout(45000)
  const exe = path.resolve(__dirname, '../../../../dist/win-unpacked/marktext.exe')
  test.skip(!fs.existsSync(exe), 'packaged exe is not built')
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'deskmark-packaged-'))
  const app = await _electron.launch({
    executablePath: exe,
    args: ['--user-data-dir', userData],
    timeout: 30000
  })
  try {
    const page = await app.firstWindow()
    await page.locator('.side-bar').waitFor({ state: 'visible', timeout: 15000 })
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().find(win => win.isVisible())?.close()
    })
    await expect.poll(async() => app.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows()
      return windows.length > 0 && windows.every(win => !win.isVisible())
    }), { timeout: 8000 }).toBe(true)
  } finally {
    stopApp(app)
    removeTree(userData)
  }
})

test('a sticky note uses the width of its window', async() => {
  test.setTimeout(45000)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deskmark-sticky-'))
  fs.writeFileSync(path.join(dir, 'milk.md'), '# Hello\n\nOne two three.\n', 'utf8')
  const launched = await launchElectron([dir], { preferences: { language: 'zh-CN' } })
  const { app, page } = launched
  try {
    await page.locator('.side-bar').waitFor({ state: 'visible', timeout: 15000 })
    await page.evaluate((root) => {
      return window.electron.ipcRenderer.invoke('mt::deskmark::sticky-open', root, root + '\\\\milk.md')
    }, dir)
    let sticky: Page | null = null
    const deadline = Date.now() + 10000
    while (!sticky && Date.now() < deadline) {
      for (const candidate of app.windows()) {
        if (candidate.url().includes('sticky=1')) sticky = candidate
      }
      if (!sticky) await new Promise((resolve) => setTimeout(resolve, 200))
    }
    if (!sticky) throw new Error('sticky window did not open')
    await sticky.locator('.mu-container').waitFor({ state: 'visible', timeout: 10000 })
    const ratio = await sticky.evaluate(() => {
      const box = document.querySelector('.mu-container')?.getBoundingClientRect()
      if (!box || window.innerWidth < 1) return 0
      return box.width / window.innerWidth
    })
    expect(ratio).toBeGreaterThan(0.85)
  } finally {
    stopApp(app)
    removeTree(dir)
  }
})

test('dragging a calendar chip moves that task onto another day', async() => {
  test.setTimeout(45000)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deskmark-drag-'))
  const note = path.join(dir, 'milk.md')
  fs.writeFileSync(note, '- [ ] 买牛奶 <!-- deskmark: id=MILK; due=2026-10-07 -->\n', 'utf8')
  const launched = await launchElectron([dir], { preferences: { language: 'en' } })
  const { app, page } = launched
  try {
    await sendIpcToRenderer(app, 'mt::deskmark-show', 'calendar')
    const chip = page.locator('.calendar-view .chip', { hasText: '买牛奶' })
    await chip.waitFor({ state: 'visible', timeout: 10000 })
    const from = await chip.evaluate((element) => element.closest('[data-day]')?.getAttribute('data-day'))
    expect(from).toBeTruthy()
    const target = page.locator('.calendar-view [data-day]').filter({ hasNotText: '买牛奶' }).first()
    const targetDay = await target.getAttribute('data-day')
    expect(targetDay).toBeTruthy()
    expect(targetDay).not.toBe(from)
    const start = await chip.boundingBox()
    const end = await target.boundingBox()
    expect(start).toBeTruthy()
    expect(end).toBeTruthy()
    if (!start || !end) return
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(end.x + end.width / 2, end.y + 8, { steps: 16 })
    await page.mouse.up()
    await expect.poll(() => fs.readFileSync(note, 'utf8'), { timeout: 8000 }).toContain(`due=${targetDay}`)
    const saved = fs.readFileSync(note, 'utf8')
    expect(saved.match(/买牛奶/g)?.length).toBe(1)
  } finally {
    stopApp(app)
    removeTree(dir)
  }
})

test('reordering the open-file list survives a restart', async() => {
  test.setTimeout(70000)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deskmark-order-'))
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'deskmark-order-user-'))
  for (const name of ['alpha.md', 'beta.md', 'gamma.md']) {
    fs.writeFileSync(path.join(dir, name), `# ${name}\n`, 'utf8')
  }
  const first = await launchElectron([dir], { preferences: { language: 'en' }, userDataDir: userData })
  let second: ElectronApplication | null = null
  try {
    const page = await pageWith(first.app, '.side-bar-file:has-text("alpha.md")')
    for (const name of ['alpha.md', 'beta.md', 'gamma.md']) {
      await page.locator('.side-bar-file', { hasText: name }).click({ timeout: 8000 })
    }
    await expect.poll(async() => (await openedNames(page)).length, { timeout: 8000 }).toBe(3)
    const before = await openedNames(page)
    const rows = page.locator('.opened-file')
    const top = await rows.nth(0).boundingBox()
    const list = await page.locator('.opened-files-list').boundingBox()
    expect(top).toBeTruthy()
    expect(list).toBeTruthy()
    if (!top || !list) return
    await page.mouse.move(top.x + 40, top.y + top.height / 2)
    await page.mouse.down()
    await page.mouse.move(list.x + 40, list.y + list.height - 2, { steps: 18 })
    await page.mouse.up()
    await expect.poll(async() => openedNames(page), { timeout: 4000 }).not.toEqual(before)
    const moved = await openedNames(page)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const sessionPath = path.join(userData, 'open-session', 'session.json')
    expect(fs.existsSync(sessionPath)).toBe(true)
    const saved = (JSON.parse(fs.readFileSync(sessionPath, 'utf8')) as { files: { name: string }[] }).files.map((file) => file.name)
    expect(saved).toEqual(moved)
    const editorStates = path.join(userData, 'editorStates')
    const bufferName = fs.readdirSync(editorStates).find((name) => name.endsWith('_editor_buffer_store.json'))
    expect(bufferName).toBeTruthy()
    const buffer = JSON.parse(fs.readFileSync(path.join(editorStates, bufferName || ''), 'utf8')) as {
      editor?: { tabs?: { filename?: string }[] }
      tabs?: { filename?: string }[]
    }
    const bufferNames = (buffer.editor?.tabs || buffer.tabs || []).map((tab) => tab.filename)
    expect(bufferNames).toEqual(moved)
    stopApp(first.app)
    second = (await launchElectron([dir], { userDataDir: userData })).app
    const restored = await pageWith(second, '.opened-file')
    await expect.poll(async() => openedNames(restored), { timeout: 10000 }).toEqual(moved)
  } finally {
    stopApp(first.app)
    if (second) stopApp(second)
    removeTree(dir)
    removeTree(userData)
  }
})

test('the word-count sidebar icon opens a labeled panel', async() => {
  test.setTimeout(45000)
  const launched = await launchWithMarkdown('# Hello\n\nOne two.\n', {
    preferences: { language: 'en' }
  })
  const { app, page } = launched
  try {
    await page.locator('.side-bar .left-column li[title="Words"]').click({ timeout: 5000 })
    const panel = page.locator('.plugin-panel')
    await expect(panel.locator('h2')).toHaveText('Words', { timeout: 8000 })
    const text = (await panel.innerText()).trim()
    expect(text.length).toBeGreaterThan('Words'.length)
    expect(text).not.toMatch(/^\s*Words\s*Close\s*$/)
  } finally {
    stopApp(app)
  }
})
