import { formatInZone, toInstant } from './time.ts'

export interface ReminderTask {
  id: string
  text: string
  remind: string | null
  done: boolean
  path: string
  line: number | null
}

export interface ReminderPlan {
  notify: ReminderTask[]
  summary: number | null
  fired: string[]
  summaryDay: string | null
}

export function planReminders(input: {
  tasks: ReminderTask[]
  now: Date
  timeZone: string
  fired: readonly string[]
  summaryDay: string | null
}): ReminderPlan {
  const today = formatInZone(input.now, input.timeZone).slice(0, 10)
  const fired = new Set(input.fired)
  const notify: ReminderTask[] = []
  let missed = 0
  for (const task of input.tasks) {
    if (task.done || !task.remind || fired.has(task.id)) continue
    const instant = toInstant(task.remind)
    if (!instant || instant.getTime() > input.now.getTime()) continue
    fired.add(task.id)
    const age = input.now.getTime() - instant.getTime()
    if (age <= 60_000) notify.push(task)
    else missed += 1
  }
  const summary = missed > 0 && input.summaryDay !== today ? missed : null
  return {
    notify,
    summary,
    fired: [...fired],
    summaryDay: summary == null ? input.summaryDay : today
  }
}
