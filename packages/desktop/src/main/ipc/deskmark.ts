import { ipcMain } from 'electron'
import log from 'electron-log'

export const registerDeskmarkHandlers = (): void => {
  ipcMain.handle('mt::deskmark::tasks', async (_event, root: string) => {
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
}
