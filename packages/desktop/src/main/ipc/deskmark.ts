import { ipcMain } from 'electron'
import log from 'electron-log'
import { join } from 'node:path'
import type { InlinePatch } from '../../../../deskmark-core/src/index.ts'
import { getStickyHost } from '../deskmark/stickies'
import { setReminderVault } from '../deskmark/reminderLoop'
import { appendJournalTask, createUlid, journalPath } from '../../../../deskmark-core/src/index.ts'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const registerDeskmarkHandlers = (): void => {
  ipcMain.handle('mt::deskmark::tasks', async(_event, root: string) => {
    try {
      if (!root) return null
      const { readTaskGroups } = await import('../deskmark/tasks')
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      return readTaskGroups(root, new Date(), timeZone)
    } catch (error) {
      log.error('Failed to read tasks', error)
      return null
    }
  })

  ipcMain.handle('mt::deskmark::edit-task', async(_event, request: {
    root: string
    notePath: string
    line: number
    patch: InlinePatch
    content: string | null
    write: boolean
  }) => {
    try {
      const { editTaskFile } = await import('../../../../deskmark-index/src/editTask.ts')
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const result = editTaskFile(
        join(request.root, request.notePath),
        request.line,
        request.patch,
        new Date(),
        timeZone,
        request.content,
        request.write
      )
      const { readTaskGroups } = await import('../deskmark/tasks')
      return { ...result, groups: readTaskGroups(request.root, new Date(), timeZone) }
    } catch (error) {
      log.error('Failed to edit task', error)
      return null
    }
  })

  ipcMain.handle('mt::deskmark::sticky-open', async(_event, vault: string, notePath: string) => {
    getStickyHost()?.open(vault, notePath)
  })

  ipcMain.handle('mt::deskmark::sticky-restore', async(_event, vault: string) => {
    setReminderVault(vault)
    getStickyHost()?.restore(vault)
  })

  ipcMain.handle('mt::deskmark::sticky-pin', async(_event, notePath: string, pinned: boolean) => {
    getStickyHost()?.setPinned(notePath, pinned)
  })

  ipcMain.handle('mt::deskmark::sticky-color', async(_event, notePath: string, color: string) => {
    getStickyHost()?.setColor(notePath, color)
  })

  ipcMain.handle('mt::deskmark::journal-task', async(_event, root: string, day: string, text: string) => {
    try {
      const relative = journalPath(day)
      const absolute = join(root, relative)
      mkdirSync(dirname(absolute), { recursive: true })
      const existing = existsSync(absolute) ? readFileSync(absolute, 'utf8') : null
      const markdown = appendJournalTask(existing, text, day, createUlid())
      const temporary = `${absolute}.deskmark-tmp`
      const { writeFileSync, renameSync } = await import('node:fs')
      writeFileSync(temporary, markdown)
      renameSync(temporary, absolute)
      const line = markdown.split(/\r?\n/).findIndex(item => item.includes(text)) + 1
      return { path: absolute, relative, line }
    } catch (error) {
      log.error('Failed to create journal task', error)
      return null
    }
  })
}
