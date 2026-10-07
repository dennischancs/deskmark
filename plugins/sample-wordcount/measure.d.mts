export interface NoteReading {
  value: string
  unit: string
  rows: { name: string, value: string }[]
  path: string
  hint: string
}

export function presentNote(input?: {
  markdown?: string
  path?: string
  lang?: string
  state?: 'ready' | 'empty' | 'failed'
}): NoteReading
