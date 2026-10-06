import { ipcMain } from 'electron'
import log from 'electron-log'
import { join } from 'node:path'
import type { InlinePatch } from '../../../../deskmark-core/src/index.ts'
import { getStickyHost } from '../deskmark/stickies'

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
    getStickyHost()?.restore(vault)
  })

  ipcMain.handle('mt::deskmark::sticky-pin', async(_event, notePath: string, pinned: boolean) => {
    getStickyHost()?.setPinned(notePath, pinned)
  })

  ipcMain.handle('mt::deskmark::sticky-color', async(_event, notePath: string, color: string) => {
    getStickyHost()?.setColor(notePath, color)
  })
}
