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
        <div
          v-for="(cell, index) of cells"
          :key="index"
          class="cell"
          :data-day="cell.date || undefined"
          :class="{ selected: mode === 'day' && cell.date === selected, today: cell.date === todayKey, pad: !cell.date, drop: cell.date != null && cell.date === hoverDay }"
          @dragover="allowDrop(cell.date, $event)"
          @drop="dropDue(cell.date, $event)"
        >
          <button
            type="button"
            class="daynum deskmark-hover"
            :class="{ marked: cell.marked, late: cell.date != null && lateDates.has(cell.date) }"
            @click="pickDay(cell.date)"
          >
            {{ cell.day }}
          </button>
          <div
            v-for="task of dayPreview(cell.date).shown"
            :key="`${cell.date}:${task.taskKey}`"
            role="button"
            tabindex="0"
            class="chip deskmark-hover"
            :class="{ late: cell.date != null && lateDates.has(cell.date), grabbing: chipDragging }"
            @pointerdown="onChipDown(task, $event)"
            @click="onChipClick(task)"
            @keydown.enter.prevent="openTask(task)"
            @keydown.space.prevent="openTask(task)"
          >
            {{ task.text }}
          </div>
          <span
            v-if="dayPreview(cell.date).extra"
            class="more"
          >+{{ dayPreview(cell.date).extra }}</span>
        </div>
      </div>
    </section>
    <section
      class="agenda"
      @dragover="onAgendaOver"
      @drop="onAgendaDrop"
    >
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
        v-if="mode === 'day' ? bridge.onDay.length === 0 && finishedTasks.length === 0 : visibleTasks.length === 0"
        class="empty"
      >
        {{ mode === 'day' ? t('calendar.emptyDay') : t('calendar.emptyGroup') }}
      </p>
      <template v-if="mode === 'day'">
        <div
          v-for="task of dayTasks"
          :key="`day:${task.notePath}:${task.taskKey}`"
          class="bridge-row"
        >
          <task-line
            :task="task"
            @open="openTask"
            @toggle="toggle"
          />
          <button
            v-if="task.line && task.due"
            type="button"
            class="deskmark-hover action"
            @click="clearDate(task)"
          >
            {{ t('calendar.clearDate') }}
          </button>
        </div>
        <h4 v-if="finishedTasks.length">
          {{ t('calendar.finished') }}
        </h4>
        <task-line
          v-for="task of finishedTasks"
          :key="`finished:${task.notePath}:${task.taskKey}`"
          :task="task"
          @open="openTask"
          @toggle="toggle"
        />
        <h4 v-if="carriedTasks.length">
          {{ t('calendar.carried') }}
        </h4>
        <div
          v-for="task of carriedTasks"
          :key="`carried:${task.notePath}:${task.taskKey}`"
          class="bridge-row"
        >
          <task-line
            :task="task"
            @open="openTask"
            @toggle="toggle"
          />
          <button
            v-if="task.line"
            type="button"
            class="deskmark-hover action"
            @click="place(task)"
          >
            {{ t('calendar.place') }}
          </button>
        </div>
        <h4 v-if="soonTasks.length">
          {{ t('calendar.soon', { days: warningDays }) }}
        </h4>
        <div
          v-for="task of soonTasks"
          :key="`soon:${task.notePath}:${task.taskKey}`"
          class="bridge-row"
        >
          <task-line
            :task="task"
            @open="openTask"
            @toggle="toggle"
          />
          <button
            v-if="task.due"
            type="button"
            class="deskmark-hover action"
            @click="showDay(task.due.slice(0, 10))"
          >
            {{ t('calendar.goToDay') }}
          </button>
        </div>
        <h4>{{ t('calendar.undated') }}</h4>
        <p
          v-if="undatedTasks.length === 0"
          class="empty"
        >
          {{ t('calendar.emptyUndated') }}
        </p>
        <div
          v-for="task of undatedTasks"
          :key="`undated:${task.notePath}:${task.taskKey}`"
          class="bridge-row"
        >
          <task-line
            :task="task"
            @open="openTask"
            @toggle="toggle"
          />
          <button
            v-if="task.line"
            type="button"
            class="deskmark-hover action"
            @click="place(task)"
          >
            {{ t('calendar.place') }}
          </button>
        </div>
      </template>
      <template v-else>
        <task-line
          v-for="task of visibleTasks"
          :key="`${task.notePath}:${task.taskKey}`"
          :task="task"
          @open="openTask"
          @toggle="toggle"
        />
      </template>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/store/project'
import { useDeskmarkStore } from '@/store/deskmark'
import { usePreferencesStore } from '@/store/preferences'
import { editDeskmarkTask } from '@/util/deskmarkEdit'
import TaskLine from '@/components/taskLine.vue'
import { agendaCounts, bridgeForDay, calendarGroup, DEADLINE_WARNING_DAYS, previewTasks, tasksForAgenda, type CalendarGroup } from '../../../../../deskmark-core/src/agenda.ts'
import { buildMonth, weekdayLabels } from '../../../../../deskmark-core/src/calendar.ts'
import { formatInZone, moveDueToDay } from '../../../../../deskmark-core/src/time.ts'
import { endTaskDrag, readTaskDrag } from '@/util/taskDrag'
import type { DeskmarkTaskGroups, DeskmarkTaskRef } from '@shared/types/ipc'

type AgendaMode = 'day' | CalendarGroup

const { t, locale } = useI18n()
const projectStore = useProjectStore()
const deskmarkStore = useDeskmarkStore()
const preferenceStore = usePreferencesStore()
const { projectTree } = storeToRefs(projectStore)
const { revision } = storeToRefs(deskmarkStore)
const {
  deskmarkScanExtensions,
  deskmarkRuleTaskLine,
  deskmarkRuleComment,
  deskmarkRuleFrontMatter,
  deskmarkRuleDateInText,
  deskmarkExtraPrefixes
} = storeToRefs(preferenceStore)
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const warningDays = DEADLINE_WARNING_DAYS
const localDay = (): string => formatInZone(new Date(), zone).slice(0, 10)
const todayKey = computed(() => localDay())
const initialDay = localDay()
const year = ref(Number(initialDay.slice(0, 4)))
const month = ref(Number(initialDay.slice(5, 7)))
const selected = ref(initialDay)
const mode = ref<AgendaMode>('day')
const text = ref('')
const hoverDay = ref<string | null>(null)
const groups = ref<DeskmarkTaskGroups | null>(null)
let loadTicket = 0
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
    done: task.status === 'done',
    completed: task.completedAt ?? null
  }))
})
const openDated = computed(() => flat.value.filter(task => !task.done && task.due))
const cells = computed(() => buildMonth(year.value, month.value, openDated.value.map(task => task.due?.slice(0, 10) || '').filter(Boolean)))
const previews = computed(() => {
  const map = new Map<string, { shown: typeof flat.value, extra: number }>()
  for (const cell of cells.value) {
    if (!cell.date) continue
    map.set(cell.date, previewTasks(flat.value, cell.date, 2))
  }
  return map
})
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
const bridge = computed(() => bridgeForDay(flat.value, selected.value, new Date(), zone))
const withoutDone = (rows: typeof flat.value): DeskmarkTaskRef[] => rows.map(({ done: _done, ...task }) => task)
const dayTasks = computed(() => withoutDone(bridge.value.onDay))
const carriedTasks = computed(() => withoutDone(bridge.value.carried))
const soonTasks = computed(() => withoutDone(bridge.value.soon))
const undatedTasks = computed(() => withoutDone(bridge.value.undated))
const finishedTasks = computed(() => withoutDone(bridge.value.finished))
const dayPreview = (day: string | null): { shown: typeof flat.value, extra: number } => {
  if (!day) return { shown: [], extra: 0 }
  return previews.value.get(day) || { shown: [], extra: 0 }
}
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
  const ticket = ++loadTicket
  if (!root.value) {
    groups.value = null
    return
  }
  const next = await window.electron.ipcRenderer.invoke('mt::deskmark::tasks', root.value, {
    extensions: deskmarkScanExtensions.value,
    taskLine: deskmarkRuleTaskLine.value,
    commentMeta: deskmarkRuleComment.value,
    frontMatter: deskmarkRuleFrontMatter.value,
    dateInText: deskmarkRuleDateInText.value,
    extraPrefixes: deskmarkExtraPrefixes.value
  })
  if (ticket !== loadTicket) return
  groups.value = next
}

watch([root, revision], () => {
  load().catch((error) => console.error(error))
}, { immediate: true })

const stopIndexTick = window.electron.ipcRenderer.on('mt::deskmark-index-tick', () => {
  load().catch((error) => console.error(error))
})

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

const showDay = (day: string): void => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return
  year.value = Number(day.slice(0, 4))
  month.value = Number(day.slice(5, 7))
  pickDay(day)
}

watch(() => deskmarkStore.focusDay, (day) => {
  if (!day) return
  showDay(day)
  deskmarkStore.focusDay = null
}, { immediate: true })

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

const writeDue = (task: DeskmarkTaskRef, due: string | null): void => {
  if (!root.value || !task.line) return
  editDeskmarkTask(root.value, task.notePath, task.line, { due }).then((next) => {
    if (next) groups.value = next
    deskmarkStore.touch()
  }).catch((error) => console.error(error))
}

const place = (task: DeskmarkTaskRef): void => {
  if (mode.value !== 'day') return
  const due = moveDueToDay(task.due, selected.value)
  if (!due) return
  writeDue(task, due)
}

const clearDate = (task: DeskmarkTaskRef): void => {
  writeDue(task, null)
}

const chipDragging = ref(false)
let chipDrag: { task: DeskmarkTaskRef, x: number, y: number, moved: boolean } | null = null
let ignoreChipClick = false

const dayAt = (x: number, y: number): string | null => {
  const hit = document.elementFromPoint(x, y)
  if (!(hit instanceof Element)) return null
  const marked = hit.closest('[data-day]')
  const day = marked?.getAttribute('data-day')
  if (day) return day
  if (mode.value === 'day' && hit.closest('.agenda')) return selected.value
  return null
}

const onChipMove = (event: PointerEvent): void => {
  if (!chipDrag) return
  const dx = event.clientX - chipDrag.x
  const dy = event.clientY - chipDrag.y
  if (!chipDrag.moved && dx * dx + dy * dy < 16) return
  chipDrag.moved = true
  chipDragging.value = true
  hoverDay.value = dayAt(event.clientX, event.clientY)
}

const onChipUp = (): void => {
  window.removeEventListener('pointermove', onChipMove)
  window.removeEventListener('pointerup', onChipUp)
  const drag = chipDrag
  chipDrag = null
  chipDragging.value = false
  const day = hoverDay.value
  hoverDay.value = null
  if (!drag?.moved) return
  ignoreChipClick = true
  if (!day || drag.task.due?.slice(0, 10) === day) return
  const due = moveDueToDay(drag.task.due, day)
  if (due) writeDue(drag.task, due)
}

// Chromium treats a drag that starts on a button as a text selection.
const onChipDown = (task: DeskmarkTaskRef, event: PointerEvent): void => {
  if (event.button !== 0 || task.status === 'done' || task.line == null) return
  chipDrag = { task, x: event.clientX, y: event.clientY, moved: false }
  window.addEventListener('pointermove', onChipMove)
  window.addEventListener('pointerup', onChipUp)
}

const onChipClick = (task: DeskmarkTaskRef): void => {
  if (ignoreChipClick) {
    ignoreChipClick = false
    return
  }
  openTask(task)
}

const allowDrop = (day: string | null, event: DragEvent): void => {
  if (!day) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  hoverDay.value = day
}

const dropDue = (day: string | null, event: DragEvent): void => {
  event.preventDefault()
  const key = readTaskDrag(event)
  endTaskDrag()
  hoverDay.value = null
  if (!day) return
  const task = flat.value.find(item => item.taskKey === key)
  if (!task || task.status === 'done' || task.line == null) return
  if (task.due?.slice(0, 10) === day) return
  const due = moveDueToDay(task.due, day)
  if (!due) return
  writeDue(task, due)
}

const onAgendaOver = (event: DragEvent): void => {
  if (mode.value !== 'day') return
  allowDrop(selected.value, event)
}

const onAgendaDrop = (event: DragEvent): void => {
  if (mode.value !== 'day') return
  dropDue(selected.value, event)
}

const clearHover = (): void => {
  hoverDay.value = null
}

onMounted(() => window.addEventListener('dragend', clearHover))
onBeforeUnmount(() => {
  stopIndexTick()
  window.removeEventListener('dragend', clearHover)
  window.removeEventListener('pointermove', onChipMove)
  window.removeEventListener('pointerup', onChipUp)
})

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
  width: min(320px, 100%);
  flex: 1 1 280px;
  min-width: 0;
}
header, form, .chips {
  display: flex;
  gap: 8px;
  align-items: center;
}
.calendar-view header {
  flex-wrap: wrap;
}
.calendar-view header h2 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
.chips {
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.journal,
.chips button,
.calendar-view header button {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: start;
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
.weekdays span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.grid {
  margin-top: 4px;
}
.cell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  min-width: 0;
  min-height: 76px;
  padding: 3px;
  border-radius: 4px;
  user-select: none;
}
.daynum {
  align-self: center;
  min-width: 1.6em;
  padding: 0;
  font-size: 12px;
  line-height: 16px;
}
.daynum.late {
  color: var(--deleteColor);
}
.chip {
  min-width: 0;
  max-width: 100%;
  height: 16px;
  padding: 0 3px;
  overflow: hidden;
  font-size: 11px;
  line-height: 16px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: grab;
  user-select: none;
  color: var(--editorColor);
  background: color-mix(in srgb, var(--themeColor) 22%, var(--editorBgColor));
  border-radius: 2px;
}
.chip.late {
  background: color-mix(in srgb, var(--deleteColor) 24%, var(--editorBgColor));
}
.chip.grabbing {
  cursor: grabbing;
}
.more {
  padding-left: 3px;
  font-size: 11px;
  line-height: 14px;
  opacity: 0.75;
}
.cell.drop {
  background: var(--themeColor10, color-mix(in srgb, var(--themeColor) 12%, transparent));
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
.agenda h4 {
  margin: 14px 0 6px;
  font-size: 13px;
  font-weight: 600;
}
.bridge-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}
.bridge-row > :first-child {
  flex: 1;
  min-width: 0;
}
.action {
  flex: 0 0 auto;
  margin-top: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--themeColor);
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
