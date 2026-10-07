import { expect, test } from '@playwright/test'
import type { Page } from 'playwright'
import { execSync } from 'node:child_process'
import { launchWithMarkdown } from './helpers'

const stopApp = (app: { process(): { pid?: number } }): void => {
  const pid = app.process().pid
  if (!pid) return
  try {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' })
  } catch {
    // The process already exited.
  }
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
