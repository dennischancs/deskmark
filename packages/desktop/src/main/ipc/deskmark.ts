import { BrowserWindow, dialog, ipcMain } from 'electron'
import log from 'electron-log'
import { join } from 'node:path'
import type { InlinePatch } from '../../../../deskmark-core/src/index.ts'
import type { DeskmarkScanOptions } from '@shared/types/ipc'
import { getStickyHost } from '../deskmark/stickies'
import { setReminderVault } from '../deskmark/reminderLoop'
import { handlePluginCall, loadSamplePlugin, loadUserPlugin, rememberPluginNote } from '../deskmark/pluginGuest'
import { appendJournalTask, blankJournal, blankTodoNote, createUlid, journalPath, todoNotePath } from '../../../../deskmark-core/src/index.ts'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

export const registerDeskmarkHandlers = (): void => {
  ipcMain.handle('mt::deskmark::plugin-info', async() => loadSamplePlugin())
  ipcMain.handle('mt::deskmark::plugin-load', async(_event, dir: string | null) => loadUserPlugin(dir))
  ipcMain.handle('mt::deskmark::pick-plugin-dir', async(event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return ''
    const { filePaths } = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    return filePaths[0] || ''
  })
  ipcMain.handle('mt::deskmark::plugin-note', async(_event, note: { vault?: string, path?: string, markdown?: string } | null) => {
    if (!note?.vault || !note.path) {
      rememberPluginNote(null)
      return
    }
    rememberPluginNote({ vault: note.vault, path: note.path, markdown: note.markdown || '' })
  })
  ipcMain.handle('mt::deskmark::plugin-call', async(_event, call: { id?: string, method?: string, path?: string }) => {
    return handlePluginCall(call || {})
  })
  ipcMain.handle('mt::deskmark::tasks', async(_event, root: string, options?: DeskmarkScanOptions | null) => {
    try {
      if (!root) return null
      const { readTaskGroups } = await import('../deskmark/tasks')
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      return readTaskGroups(root, new Date(), timeZone, options)
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
      const { rememberFile, currentGroups } = await import('../deskmark/scanner')
      if (result.changed) rememberFile(request.root, request.notePath, result.markdown)
      return { ...result, groups: currentGroups(request.root, new Date(), timeZone) }
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
  ipcMain.handle('mt::deskmark::sticky-font', async(_event, notePath: string, fontSize: number) => {
    getStickyHost()?.setFont(notePath, fontSize)
  })
  ipcMain.handle('mt::deskmark::sticky-opacity', async(_event, notePath: string, opacity: number) => {
    return getStickyHost()?.setOpacity(notePath, opacity) ?? false
  })
  ipcMain.handle('mt::deskmark::sticky-edge-hide', async(_event, notePath: string, enabled: boolean) => {
    getStickyHost()?.setEdgeHide(notePath, enabled)
  })
  ipcMain.handle('mt::deskmark::sticky-lock', async(_event, notePath: string, locked: boolean) => {
    getStickyHost()?.setLocked(notePath, locked)
  })
  ipcMain.handle('mt::deskmark::sticky-pass', async(_event, notePath: string, enabled: boolean) => {
    getStickyHost()?.setPass(notePath, enabled)
  })
  ipcMain.handle('mt::deskmark::sticky-pass-hit', async(_event, notePath: string, ignore: boolean) => {
    getStickyHost()?.setPassHit(notePath, ignore)
  })
  ipcMain.handle('mt::deskmark::sticky-bottom', async(_event, notePath: string, enabled: boolean) => {
    getStickyHost()?.setBottom(notePath, enabled)
  })
  ipcMain.handle('mt::deskmark::sticky-list', async(_event, notePath: string) => {
    return getStickyHost()?.listOthers(notePath) ?? []
  })
  ipcMain.handle('mt::deskmark::sticky-show', async(_event, notePath: string) => {
    getStickyHost()?.showNote(notePath)
  })
  ipcMain.handle('mt::deskmark::sticky-settings', async() => {
    getStickyHost()?.openSettings()
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

  ipcMain.handle('mt::deskmark::journal-open', async(_event, root: string, day: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
    try {
      const relative = journalPath(day)
      const absolute = join(root, relative)
      mkdirSync(dirname(absolute), { recursive: true })
      const created = !existsSync(absolute)
      if (created) {
        const temporary = `${absolute}.deskmark-tmp`
        const { writeFileSync, renameSync } = await import('node:fs')
        writeFileSync(temporary, blankJournal(day))
        renameSync(temporary, absolute)
      }
      return { path: absolute, relative, created }
    } catch (error) {
      log.error('Failed to open journal', error)
      return null
    }
  })

  ipcMain.handle('mt::deskmark::new-todo-note', async(_event, root: string, title: string) => {
    if (!root) return null
    try {
      const id = createUlid()
      const relative = todoNotePath(id)
      const absolute = join(root, relative)
      mkdirSync(dirname(absolute), { recursive: true })
      const temporary = `${absolute}.deskmark-tmp`
      const { writeFileSync, renameSync } = await import('node:fs')
      writeFileSync(temporary, blankTodoNote(id, title || ''))
      renameSync(temporary, absolute)
      return { path: absolute, relative }
    } catch (error) {
      log.error('Failed to create todo note', error)
      return null
    }
  })

  ipcMain.handle('mt::deskmark::login-get', () => {
    return getStickyHost()?.loginEnabled() ?? false
  })

  ipcMain.handle('mt::deskmark::login-set', (_event, enabled: boolean) => {
    getStickyHost()?.setLogin(enabled)
    return getStickyHost()?.loginEnabled() ?? enabled
  })
}
