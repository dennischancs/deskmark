import { parseNote, temporaryKey } from './note.ts'
import type { AgendaItem } from './types.ts'

export {
  agendaCounts,
  bridgeForDay,
  calendarGroup,
  compareAgenda,
  DEADLINE_WARNING_DAYS,
  filterTasks,
  isOverdue,
  markedDates,
  previewTasks,
  smartList,
  sortTasks,
  tasksForAgenda,
  tasksOnDate
} from './agenda.ts'

export function agendaFromMarkdown(path: string, markdown: string): AgendaItem[] {
  const parsed = parseNote(markdown, path)
  const items: AgendaItem[] = []
  if (parsed.fields.kind === 'todo') {
    const text = parsed.title ?? fileName(path)
    items.push({
      source: 'note',
      path,
      line: null,
      id: parsed.fields.id,
      temporaryKey: temporaryKey(path, text, 0),
      text,
      done: parsed.fields.status === 'done',
      due: parsed.fields.due,
      remind: parsed.fields.remind,
      priority: parsed.fields.priority,
      repeat: parsed.fields.repeat,
      repeatSupported: parsed.fields.repeatSupported
    })
  }
  for (const task of parsed.tasks) {
    items.push({
      source: 'inline',
      path,
      line: task.line,
      id: task.id,
      temporaryKey: task.temporaryKey,
      text: task.text,
      done: task.checked,
      due: task.due,
      remind: task.remind,
      priority: task.priority,
      repeat: task.repeat,
      repeatSupported: task.repeatSupported
    })
  }
  return items
}

function fileName(path: string): string {
  const parts = path.split(/[/\\]/)
  return parts[parts.length - 1] || path
}
