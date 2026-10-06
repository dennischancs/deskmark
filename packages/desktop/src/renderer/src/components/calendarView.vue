<template>
  <div class="calendar-view deskmark-ui">
    <section class="month">
      <header>
        <button
          type="button"
          class="deskmark-hover"
          @click="shift(-1)"
        >
          ‹
        </button>
        <h2>{{ title }}</h2>
        <button
          type="button"
          class="deskmark-hover"
          @click="goToday"
        >
          {{ t('calendar.today') }}
        </button>
        <button
          type="button"
          class="deskmark-hover"
          @click="shift(1)"
        >
          ›
        </button>
      </header>
      <div class="weekdays">
        <span
          v-for="(label, index) of weekdays"
          :key="index"
        >{{ label }}</span>
      </div>
      <div class="grid">
        <button
          v-for="(cell, index) of cells"
          :key="index"
          type="button"
          class="deskmark-hover"
          :class="{ marked: cell.marked, selected: mode === 'day' && cell.date === selected, today: cell.date === todayKey, pad: !cell.date }"
          @click="pickDay(cell.date)"
        >
          <span>{{ cell.day }}</span>
          <i
            v-if="cell.marked"
            class="dot"
            :class="{ late: cell.date && lateDates.has(cell.date) }"
          />
        </button>
      </div>
    </section>
    <section class="agenda">
      <div class="chips">
        <button
          type="button"
          class="deskmark-hover"
          :class="{ active: mode === 'day' }"
          @click="mode = 'day'"
        >
          {{ t('calendar.thisDay') }}
        </button>
        <button
          v-for="chip of chips"
          :key="chip.id"
          type="button"
          class="deskmark-hover"
          :class="{ active: mode === chip.id }"
          @click="mode = chip.id"
        >
          {{ t(chip.label) }} {{ chip.count }}
        </button>
      </div>
      <h3>{{ heading }}</h3>
      <button
        v-if="mode === 'day'"
        type="button"
        class="deskmark-hover journal"
        @click="openJournal"
      >
        {{ t('calendar.journal') }}
      </button>
      <p
        v-if="visibleTasks.length === 0"
        class="empty"
      >
        {{ mode === 'day' ? t('calendar.emptyDay') : t('calendar.emptyGroup') }}
      </p>
      <task-line
        v-for="task of visibleTasks"
        :key="`${task.notePath}:${task.taskKey}`"
        :task="task"
        @open="openTask"
        @toggle="toggle"
      />
      <form
        v-if="mode === 'day'"
        @submit.prevent="create"
      >
        <input
          v-model="text"
          :placeholder="t('calendar.placeholder')"
        >
        <button
          type="submit"
          class="deskmark-primary"
        >
          {{ t('calendar.new') }}
        </button>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/store/project'
import { useDeskmarkStore } from '@/store/deskmark'
import { editDeskmarkTask } from '@/util/deskmarkEdit'
import TaskLine from '@/components/taskLine.vue'
import { agendaCounts, calendarGroup, tasksForAgenda, type CalendarGroup } from '../../../../../deskmark-core/src/query.ts'
import { buildMonth, weekdayLabels } from '../../../../../deskmark-core/src/calendar.ts'
import { formatInZone } from '../../../../../deskmark-core/src/time.ts'
import type { DeskmarkTaskGroups, DeskmarkTaskRef } from '@shared/types/ipc'

type AgendaMode = 'day' | CalendarGroup

const { t, locale } = useI18n()
const projectStore = useProjectStore()
const deskmarkStore = useDeskmarkStore()
const { projectTree } = storeToRefs(projectStore)
const { revision } = storeToRefs(deskmarkStore)
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const localDay = (): string => formatInZone(new Date(), zone).slice(0, 10)
const todayKey = computed(() => localDay())
const initialDay = localDay()
const year = ref(Number(initialDay.slice(0, 4)))
const month = ref(Number(initialDay.slice(5, 7)))
const selected = ref(initialDay)
const mode = ref<AgendaMode>('day')
const text = ref('')
const groups = ref<DeskmarkTaskGroups | null>(null)
const root = computed(() => projectTree.value?.pathname || '')
const title = computed(() => new Intl.DateTimeFormat(String(locale.value || 'en'), {
  year: 'numeric',
  month: 'long'
}).format(new Date(year.value, month.value - 1, 1)))
const weekdays = computed(() => weekdayLabels(String(locale.value || 'en')))
const flat = computed(() => {
  const value = groups.value
  if (!value) return []
  return [...value.overdue, ...value.today, ...value.upcoming, ...value.inbox, ...value.done].map(task => ({
    ...task,
    done: task.status === 'done'
  }))
})
const openDated = computed(() => flat.value.filter(task => !task.done && task.due))
const cells = computed(() => buildMonth(year.value, month.value, openDated.value.map(task => task.due?.slice(0, 10) || '').filter(Boolean)))
const lateDates = computed(() => new Set(
  openDated.value
    .filter(task => calendarGroup({ done: false, due: task.due }, new Date(), zone) === 'overdue')
    .map(task => task.due!.slice(0, 10))
))
const counts = computed(() => agendaCounts(flat.value, new Date(), zone))
const chips = computed(() => [
  { id: 'overdue' as const, label: 'calendar.overdue', count: counts.value.overdue },
  { id: 'today' as const, label: 'calendar.today', count: counts.value.today },
  { id: 'next7' as const, label: 'calendar.next7', count: counts.value.next7 },
  { id: 'later' as const, label: 'calendar.later', count: counts.value.later },
  { id: 'undated' as const, label: 'calendar.undated', count: counts.value.undated }
])
const visibleTasks = computed(() => {
  const rows = mode.value === 'day'
    ? tasksForAgenda(flat.value, { kind: 'day', day: selected.value }, new Date(), zone)
    : tasksForAgenda(flat.value, { kind: 'group', group: mode.value }, new Date(), zone)
  return rows.map(({ done: _done, ...task }) => task)
})
const heading = computed(() => {
  if (mode.value !== 'day') return t(`calendar.${mode.value}`)
  const [y, m, d] = selected.value.split('-').map(Number)
  if (!y || !m || !d) return selected.value
  return new Intl.DateTimeFormat(String(locale.value || 'en'), {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(new Date(y, m - 1, d))
})

const load = async (): Promise<void> => {
  if (!root.value) {
    groups.value = null
    return
  }
  groups.value = await window.electron.ipcRenderer.invoke('mt::deskmark::tasks', root.value)
}

watch([root, revision], () => {
  load().catch((error) => console.error(error))
}, { immediate: true })

const shift = (delta: number): void => {
  const next = new Date(year.value, month.value - 1 + delta, 1)
  year.value = next.getFullYear()
  month.value = next.getMonth() + 1
}

const goToday = (): void => {
  const day = localDay()
  year.value = Number(day.slice(0, 4))
  month.value = Number(day.slice(5, 7))
  selected.value = day
  mode.value = 'day'
}

const pickDay = (day: string | null): void => {
  if (!day) return
  selected.value = day
  mode.value = 'day'
}

const reveal = (path: string, line?: number | null): void => {
  deskmarkStore.calendarOpen = false
  window.electron.ipcRenderer.send('mt::open-file', path, line ? { deskmarkLine: line } : {})
}

const openTask = (task: DeskmarkTaskRef): void => {
  if (!root.value) return
  deskmarkStore.select(task)
  reveal(window.path.join(root.value, task.notePath), task.line)
}

const toggle = (task: DeskmarkTaskRef): void => {
  if (!root.value || !task.line) return
  editDeskmarkTask(root.value, task.notePath, task.line, {
    checked: task.status !== 'done'
  }).then((next) => {
    if (next) groups.value = next
    deskmarkStore.touch()
  }).catch((error) => console.error(error))
}

const create = async (): Promise<void> => {
  if (!root.value || mode.value !== 'day' || !selected.value || !text.value.trim()) return
  const created = await window.electron.ipcRenderer.invoke('mt::deskmark::journal-task', root.value, selected.value, text.value.trim())
  text.value = ''
  if (!created) return
  deskmarkStore.touch()
  await load()
}

const openJournal = async (): Promise<void> => {
  if (!root.value || mode.value !== 'day') return
  const opened = await window.electron.ipcRenderer.invoke('mt::deskmark::journal-open', root.value, selected.value)
  if (!opened?.path) return
  reveal(opened.path)
}
</script>

<style scoped>
.calendar-view {
  flex: 1;
  display: flex;
  gap: 28px;
  align-items: flex-start;
  overflow: auto;
  padding: 16px 20px;
}
.month {
  flex: 1;
  min-width: 280px;
}
.agenda {
  width: 320px;
  flex: 0 0 320px;
}
header, form, .chips {
  display: flex;
  gap: 8px;
  align-items: center;
}
.chips {
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.weekdays, .grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.weekdays {
  margin-top: 12px;
  font-size: 12px;
  opacity: 0.7;
  text-align: center;
}
.grid {
  margin-top: 4px;
}
.grid button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 42px;
  border-radius: 4px;
}
.dot {
  width: 4px;
  height: 4px;
  margin-top: 3px;
  border-radius: 2px;
  background: var(--themeColor);
}
.dot.late {
  background: var(--deleteColor);
}
.today {
  box-shadow: inset 0 0 0 1px var(--themeColor);
}
.chips button, .journal, form button {
  padding: 4px 8px;
  border-radius: 4px;
}
.chips button.active {
  background: var(--themeColor30, color-mix(in srgb, var(--themeColor) 30%, transparent));
}
form {
  margin-top: 12px;
}
form input {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
}
.journal {
  margin: 0 0 8px;
}
.empty {
  margin: 8px 0;
}
.pad {
  visibility: hidden;
}
@media (max-width: 860px) {
  .calendar-view {
    flex-direction: column;
  }
  .agenda {
    width: auto;
    flex: 1;
  }
}
</style>
