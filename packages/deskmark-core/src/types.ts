export type NoteKind = 'note' | 'todo'
export type NoteStatus = 'open' | 'done'
export type Priority = 'low' | 'normal' | 'high'
export type KnownRepeat = 'none' | 'daily' | 'weekly' | 'monthly'
export type CalendarGroup = 'overdue' | 'today' | 'next7' | 'later' | 'undated'
export type SmartList = 'inbox' | 'today' | 'upcoming' | 'overdue' | 'done'

export interface FieldEntry {
  key: string
  value: string
  raw: string[]
}

export interface NoteFields {
  id: string | null
  kind: NoteKind
  status: NoteStatus
  due: string | null
  remind: string | null
  priority: Priority
  repeat: string
  repeatSupported: boolean
  completed: string | null
  unknown: FieldEntry[]
  issues: string[]
}

export interface TaskItem {
  line: number
  indent: string
  marker: string
  checked: boolean
  text: string
  id: string | null
  due: string | null
  remind: string | null
  priority: Priority
  repeat: string
  repeatSupported: boolean
  completed: string | null
  temporaryKey: string
  unknown: FieldEntry[]
}

export interface ParsedNote {
  title: string | null
  frontMatterError: string | null
  fields: NoteFields
  tasks: TaskItem[]
}

export interface EditResult {
  markdown: string
  changed: boolean
  error: string | null
  advanced: boolean
  unsupportedRepeat: boolean
}

export interface AgendaItem {
  source: 'inline' | 'note'
  path: string
  line: number | null
  id: string | null
  temporaryKey: string
  text: string
  done: boolean
  due: string | null
  remind: string | null
  priority: Priority
  repeat: string
  repeatSupported: boolean
}

export interface InlinePatch {
  text?: string
  checked?: boolean
  due?: string | null
  remind?: string | null
  priority?: Priority | null
  repeat?: string | null
  completed?: string | null
  id?: string
}
