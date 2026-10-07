import { expect, test } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron, removeTree } from './helpers'

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

const recentRemind = (): string => {
  const when = new Date(Date.now() - 30_000)
  const pad = (value: number): string => String(value).padStart(2, '0')
  const offsetMinutes = -when.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}:${pad(when.getSeconds())}${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
}

test('a due reminder shows inside the editor window', async() => {
  test.setTimeout(45000)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deskmark-remind-'))
  const note = path.join(dir, 'milk.md')
  fs.writeFileSync(note, `- [ ] 买牛奶 <!-- deskmark: id=MILK; remind=${recentRemind()} -->\n`, 'utf8')
  const launched = await launchElectron([dir], { preferences: { language: 'zh-CN' } })
  const { app } = launched
  try {
    const deadline = Date.now() + 20000
    let found = false
    while (Date.now() < deadline) {
      for (const page of app.windows()) {
        const notice = page.locator('.mt-notification', { hasText: '买牛奶' })
        if (await notice.count() > 0) {
          found = true
          break
        }
      }
      if (found) break
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    expect(found).toBe(true)
  } finally {
    stopApp(app)
    removeTree(dir)
  }
})
