<template>
  <div class="calendar-view">
    <header>
      <button
        type="button"
        @click="shift(-1)"
      >
        ‹
      </button>
      <h2>{{ title }}</h2>
      <button
        type="button"
        @click="shift(1)"
      >
        ›
      </button>
    </header>
    <div class="grid">
      <button
        v-for="(cell, index) of cells"
        :key="index"
        type="button"
        :class="{ marked: cell.marked, selected: cell.date === selected, pad: !cell.date }"
        @click="cell.date && (selected = cell.date)"
      >
        {{ cell.day }}
      </button>
    </div>
    <ul>
      <li
        v-for="task of dayTasks"
        :key="`${task.notePath}:${task.taskKey}`"
      >
        <button
          type="button"
          @click="openTask(task)"
        >
          {{ task.text }}
        </button>
      </li>
    </ul>
    <form @submit.prevent="create">
      <input
        v-model="text"
        :placeholder="t('calendar.placeholder')"
      >
      <button type="submit">
        {{ t('calendar.new') }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/store/project'
import { buildMonth } from '../../../../../deskmark-core/src/calendar.ts'
import type { DeskmarkTaskGroups, DeskmarkTaskRef } from '@shared/types/ipc'

const { t } = useI18n()
const projectStore = useProjectStore()
const { projectTree } = storeToRefs(projectStore)
const today = new Date()
const year = ref(today.getFullYear())
const month = ref(today.getMonth() + 1)
const selected = ref(new Intl.DateTimeFormat('en-CA').format(today))
const text = ref('')
const groups = ref<DeskmarkTaskGroups | null>(null)
const root = computed(() => projectTree.value?.pathname || '')
const title = computed(() => `${year.value}-${String(month.value).padStart(2, '0')}`)
const dated = computed(() => {
  const value = groups.value
  if (!value) return []
  return [...value.overdue, ...value.today, ...value.upcoming, ...value.done]
})
const cells = computed(() => buildMonth(year.value, month.value, dated.value.map(task => task.due?.slice(0, 10) || '').filter(Boolean)))
const dayTasks = computed(() => dated.value.filter(task => task.due?.slice(0, 10) === selected.value))

const load = async (): Promise<void> => {
  if (!root.value) {
    groups.value = null
    return
  }
  groups.value = await window.electron.ipcRenderer.invoke('mt::deskmark::tasks', root.value)
}

watch(root, () => {
  load().catch((error) => console.error(error))
}, { immediate: true })

const shift = (delta: number): void => {
  const next = new Date(year.value, month.value - 1 + delta, 1)
  year.value = next.getFullYear()
  month.value = next.getMonth() + 1
}

const openTask = (task: DeskmarkTaskRef): void => {
  if (!root.value) return
  const fullPath = window.path.join(root.value, task.notePath)
  window.electron.ipcRenderer.send('mt::open-file', fullPath, task.line ? { deskmarkLine: task.line } : {})
}

const create = async (): Promise<void> => {
  if (!root.value || !selected.value || !text.value.trim()) return
  const created = await window.electron.ipcRenderer.invoke('mt::deskmark::journal-task', root.value, selected.value, text.value.trim())
  text.value = ''
  await load()
  if (created?.path) {
    window.electron.ipcRenderer.send('mt::open-file', created.path, created.line ? { deskmarkLine: created.line } : {})
  }
}
</script>

<style scoped>
.calendar-view {
  flex: 1;
  overflow: auto;
  padding: 16px;
}
header, form {
  display: flex;
  gap: 8px;
  align-items: center;
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
  margin: 12px 0;
}
.grid button, form button, li button {
  border: 0;
  background: transparent;
  cursor: pointer;
}
.grid button {
  height: 36px;
}
.marked {
  font-weight: 700;
  text-decoration: underline;
}
.selected {
  background: #d6e6ff;
}
.pad {
  visibility: hidden;
}
</style>
