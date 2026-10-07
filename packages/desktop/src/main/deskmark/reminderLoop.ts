import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Notification } from 'electron'
import log from 'electron-log'
import { planReminders, type ReminderTask } from '../../../../deskmark-core/src/reminders.ts'
import type { DeskmarkReminderNotice } from '@shared/types/ipc'
import { t } from '../i18n'
import { normalizeReminderSeconds, reminderCaption, reminderTimeoutType } from './windowsToast'
import { readTaskGroups } from './tasks'
import { whenScanFinishes } from './scanner'

let currentVault: string | null = null
let tickFn: (() => void) | null = null
// Windows keeps the toast after this function returns. If nothing retains the
// Notification, the click listener can be collected before the user presses it.
const shownNotices = new Set<Notification>()

function showSystemNotice(note: Notification, visibleMs: number, open?: () => void): void {
  shownNotices.add(note)
  let settled = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const drop = (): void => {
    if (settled) return
    settled = true
    if (timer) clearTimeout(timer)
    shownNotices.delete(note)
  }
  note.on('show', () => {
    shownNotices.add(note)
  })
  note.on('failed', (_event, error) => {
    log.warn('reminder toast failed', error)
    drop()
  })
  note.on('close', drop)
  note.on('click', () => {
    drop()
    open?.()
  })
  note.on('action', () => {
    drop()
    open?.()
  })
  if (visibleMs > 0) {
    timer = setTimeout(() => {
      if (settled) return
      drop()
      note.close()
    }, visibleMs)
  }
  note.show()
}

export function setReminderVault(vault: string | null): void {
  currentVault = vault || null
  if (currentVault) setTimeout(() => tickFn?.(), 300)
}

interface ReminderFile {
  fired: string[]
  summaryDay: string | null
}

export function startReminderLoop(options: {
  userDataPath: string
  getVault?: () => string | null
  remindersEnabled?: () => boolean
  reminderSeconds?: () => unknown
  openNote: (vault: string, notePath: string, line: number | null) => void
  announce?: (notice: DeskmarkReminderNotice) => void
}): void {
  const file = join(options.userDataPath, 'reminder-state.json')
  const read = (): ReminderFile => {
    if (!existsSync(file)) return { fired: [], summaryDay: null }
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as ReminderFile
    } catch {
      return { fired: [], summaryDay: null }
    }
  }
  const write = (state: ReminderFile): void => {
    mkdirSync(options.userDataPath, { recursive: true })
    const temporary = `${file}.tmp`
    writeFileSync(temporary, JSON.stringify(state))
    renameSync(temporary, file)
  }
  const tick = (): void => {
    if (options.remindersEnabled && !options.remindersEnabled()) return
    const vault = options.getVault ? options.getVault() : currentVault
    if (!vault) return
    try {
      const groups = readTaskGroups(vault)
      const tasks: ReminderTask[] = [groups.overdue, groups.today, groups.upcoming, groups.inbox, groups.done].flat().map(task => ({
        id: task.taskKey,
        text: task.text,
        remind: task.remindAt,
        done: task.status === 'done',
        path: task.notePath,
        line: task.line
      }))
      const previous = read()
      const plan = planReminders({
        tasks,
        now: new Date(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        fired: previous.fired,
        summaryDay: previous.summaryDay
      })
      write({ fired: plan.fired, summaryDay: plan.summaryDay })
      const system = Notification.isSupported()
      const visibleMs = normalizeReminderSeconds(options.reminderSeconds?.()) * 1000
      for (const task of plan.notify) {
        const body = reminderCaption(task.path, task.remind)
        if (system) {
          const note = new Notification({
            title: task.text,
            body,
            timeoutType: reminderTimeoutType(process.platform),
            actions: [{ type: 'button', text: t('reminder.open') }]
          })
          showSystemNotice(note, visibleMs, () => options.openNote(vault, task.path, task.line))
        }
        options.announce?.({
          title: task.text,
          body,
          vault,
          notePath: task.path,
          line: task.line
        })
      }
      if (plan.summary) {
        const title = t('reminder.missed', { count: plan.summary })
        if (system) {
          const summary = new Notification({
            title,
            body: '',
            timeoutType: reminderTimeoutType(process.platform)
          })
          showSystemNotice(summary, visibleMs)
        }
        options.announce?.({
          title,
          body: '',
          vault,
          notePath: '',
          line: null
        })
      }
    } catch {
      // A bad vault should not stop the editor.
    }
  }
  whenScanFinishes(tick)
  tickFn = tick
  setTimeout(tick, 1000)
  setInterval(tick, 60_000)
}
