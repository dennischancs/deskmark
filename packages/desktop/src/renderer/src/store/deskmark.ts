import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DeskmarkTaskRef } from '@shared/types/ipc'

export interface DeskmarkNoteLink {
  title: string
  href: string
}

export const useDeskmarkStore = defineStore('deskmark', () => {
  const selected = ref<DeskmarkTaskRef | null>(null)
  const revision = ref(0)
  const calendarOpen = ref(false)
  const notes = ref<DeskmarkNoteLink[]>([])

  const select = (task: DeskmarkTaskRef | null): void => {
    selected.value = task
  }

  const touch = (): void => {
    revision.value += 1
  }

  return { selected, select, revision, touch, calendarOpen, notes }
})
