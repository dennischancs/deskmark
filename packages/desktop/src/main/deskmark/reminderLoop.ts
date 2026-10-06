import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Notification } from 'electron'
import { planReminders, type ReminderTask } from '../../../../deskmark-core/src/reminders.ts'
import { readTaskGroups } from './tasks'

let currentVault: string | null = null

export function setReminderVault(vault: string | null): void {
  currentVault = vault || null
}

interface ReminderFile {
  fired: string[]
  summaryDay: string | null
}

export function startReminderLoop(options: {
  userDataPath: string
  getVault?: () => string | null
  openNote: (vault: string, notePath: string, line: number | null) => void
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
      if (!Notification.isSupported()) return
      for (const task of plan.notify) {
        const note = new Notification({ title: task.text, body: task.remind || '' })
        note.on('click', () => options.openNote(vault, task.path, task.line))
        note.show()
      }
      if (plan.summary) {
        new Notification({ title: String(plan.summary), body: '' }).show()
      }
    } catch {
      // A bad vault should not stop the editor.
    }
  }
  setInterval(tick, 60_000)
}
