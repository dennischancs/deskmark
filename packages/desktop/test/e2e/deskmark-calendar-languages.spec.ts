import { expect, test } from '@playwright/test'
import type { ElectronApplication, Locator, Page } from 'playwright'
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron, removeTree, sendIpcToRenderer } from './helpers'

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
    // The process already exited.
  }
}

const insideCalendar = async(control: Locator): Promise<boolean> => {
  return control.evaluate((element) => {
    const view = element.closest('.calendar-view')?.getBoundingClientRect()
    const box = element.getBoundingClientRect()
    if (!view || box.width === 0 || box.height === 0) return false
    const textFits = element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1
    const inside = box.left >= view.left - 1 && box.right <= view.right + 1 && box.top >= view.top - 1 && box.bottom <= view.bottom + 1
    return textFits && inside
  })
}

const calendarPage = async(app: ElectronApplication): Promise<Page> => {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    for (const candidate of app.windows()) {
      const view = candidate.locator('.calendar-view')
      if (await view.count() === 0) continue
      const box = await view.boundingBox()
      if (box && box.width > 20 && box.height > 20) return candidate
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('calendar was not shown')
}

test('German, French, Russian, and Japanese calendar buttons stay inside the calendar', async() => {
  test.setTimeout(90000)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deskmark-lang-'))
  fs.writeFileSync(path.join(dir, 'milk.md'), '- [ ] 买牛奶 <!-- deskmark: id=MILK; due=2026-10-07 -->\n', 'utf8')
  const launched = await launchElectron([dir], { preferences: { language: 'en' } })
  const { app } = launched
  try {
    await sendIpcToRenderer(app, 'mt::deskmark-show', 'calendar')
    let page = await calendarPage(app)
    let view = page.locator('.calendar-view')
    for (const language of ['de', 'fr', 'ru', 'ja']) {
      const pack = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../static/locales', `${language}.json`), 'utf8')) as {
        app: { displayName: string }
        calendar: Record<string, string>
      }
      await page.evaluate((next) => {
        const bridge = (window as unknown as {
          electron: { ipcRenderer: { send: (channel: string, payload: unknown) => void } }
        }).electron
        bridge.ipcRenderer.send('mt::set-user-preference', { language: next })
      }, language)
      const today = view.locator('header button', { hasText: pack.calendar.today })
      const journal = view.locator('.journal')
      await expect(today).toBeVisible({ timeout: 8000 })
      await expect(journal).toHaveText(pack.calendar.journal, { timeout: 8000 })
      page = await calendarPage(app)
      view = page.locator('.calendar-view')
      await expect.poll(async() => {
        const titles = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((win) => win.getTitle()))
        return titles.some((title) => title.includes(pack.app.displayName))
      }, { timeout: 8000 }).toBe(true)
      for (const label of [pack.calendar.thisDay, pack.calendar.overdue, pack.calendar.next7, pack.calendar.later]) {
        const chip = view.locator('.chips button', { hasText: label })
        await expect(chip).toBeVisible()
        await expect.poll(() => insideCalendar(chip), { timeout: 4000 }).toBe(true)
      }
      await expect.poll(() => insideCalendar(today), { timeout: 4000 }).toBe(true)
      await expect.poll(() => insideCalendar(journal), { timeout: 4000 }).toBe(true)
    }
  } finally {
    stopApp(app)
    removeTree(dir)
  }
})
