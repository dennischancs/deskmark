<template>
  <div class="deskmark-tasks deskmark-ui deskmark-side">
    <p
      v-if="!root"
      class="empty"
    >
      {{ t('sideBar.tasks.empty') }}
    </p>
    <button
      v-if="currentPath"
      class="deskmark-hover stick"
      type="button"
      @click="stickCurrent"
    >
      {{ t('sticky.open') }}
    </button>
    <p
      v-if="scanning"
      class="empty"
    >
      {{ t('sideBar.tasks.scanning', { done: seen }) }}
    </p>
    <div
      v-if="root"
      class="tools"
    >
      <input
        v-model="query"
        type="search"
        :placeholder="t('sideBar.tasks.search')"
      >
      <div
        class="sorts"
        role="group"
        :aria-label="t('sideBar.tasks.sort')"
      >
        <button
          v-for="choice of orders"
          :key="choice"
          type="button"
          :class="{ on: order === choice }"
          :aria-pressed="order === choice"
          @click="order = choice"
        >
          {{ t(orderLabel[choice]) }}
        </button>
      </div>
    </div>
    <p
      v-if="root && query.trim() && visibleGroups.length === 0 && unreadable.length === 0"
      class="empty"
    >
      {{ t('sideBar.tasks.noMatch') }}
    </p>
    <section v-if="unreadable.length">
      <h3>{{ t('sideBar.tasks.unreadable') }}</h3>
      <button
        v-for="note of unreadable"
        :key="note.path"
        type="button"
        class="deskmark-hover unreadable-note"
        @click="openUnreadable(note.path)"
      >
        {{ note.path }}
      </button>
    </section>
    <section
      v-for="group of visibleGroups"
      :key="group.id"
    >
      <h3>{{ t(group.label) }}</h3>
      <div
        v-for="task of group.items"
        :key="`${task.notePath}:${task.taskKey}`"
        class="task-block"
      >
        <task-line
          :task="task"
          @open="openTask"
          @toggle="toggle"
        />
        <form
          v-if="editingKey === taskIdentity(task)"
          class="editor"
          @submit.prevent="save(task)"
        >
          <label>
            {{ t('sideBar.tasks.sentence') }}
            <input
              v-model="sentence"
              type="text"
            >
          </label>
          <label>
            {{ t('sideBar.tasks.due') }}
            <input
              v-model="due"
              type="date"
            >
          </label>
          <label>
            {{ t('sideBar.tasks.remind') }}
            <input
              v-model="remind"
              type="datetime-local"
            >
          </label>
          <label>
            {{ t('sideBar.tasks.priority') }}
            <select v-model="priority">
              <option value="low">{{ t('sideBar.tasks.low') }}</option>
              <option value="normal">{{ t('sideBar.tasks.normal') }}</option>
              <option value="high">{{ t('sideBar.tasks.high') }}</option>
            </select>
          </label>
          <label>
            {{ t('sideBar.tasks.repeat') }}
            <select v-model="repeat">
              <option value="none">{{ t('sideBar.tasks.none') }}</option>
              <option value="daily">{{ t('sideBar.tasks.daily') }}</option>
              <option value="weekly">{{ t('sideBar.tasks.weekly') }}</option>
              <option value="monthly">{{ t('sideBar.tasks.monthly') }}</option>
            </select>
          </label>
          <div class="actions">
            <button
              type="submit"
              class="deskmark-primary"
            >
              {{ t('sideBar.tasks.save') }}
            </button>
            <button
              type="button"
              class="deskmark-hover"
              @click="openNote(task)"
            >
              {{ t('sideBar.tasks.openNote') }}
            </button>
            <button
              v-if="task.due"
              type="button"
              class="deskmark-hover"
              @click="showOnCalendar(task)"
            >
              {{ t('calendar.showOnCalendar') }}
            </button>
          </div>
        </form>
        <button
          v-if="task.due && editingKey !== taskIdentity(task)"
          type="button"
          class="deskmark-hover calendar-link"
          @click="showOnCalendar(task)"
        >
          {{ t('calendar.showOnCalendar') }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/store/project'
import { useEditorStore } from '@/store/editor'
import { useDeskmarkStore } from '@/store/deskmark'
import { usePreferencesStore } from '@/store/preferences'
import { editDeskmarkTask } from '@/util/deskmarkEdit'
import { showDeskmarkTarget } from '@/util/deskmarkView'
import { watchDeskmarkIndex } from '@/util/deskmarkIndex'
import TaskLine from '@/components/taskLine.vue'
import { calendarGroup, filterTasks, sortTasks, type TaskOrder } from '../../../../../../deskmark-core/src/agenda.ts'
import { localDateTimeToIso } from '../../../../../../deskmark-core/src/time.ts'
import type { DeskmarkTaskGroups, DeskmarkTaskRef } from '@shared/types/ipc'

const { t } = useI18n()
const projectStore = useProjectStore()
const deskmarkStore = useDeskmarkStore()
const editorStore = useEditorStore()
const preferenceStore = usePreferencesStore()
const { projectTree } = storeToRefs(projectStore)
const { revision } = storeToRefs(deskmarkStore)
const { currentFile } = storeToRefs(editorStore)
const {
  deskmarkScanExtensions,
  deskmarkRuleTaskLine,
  deskmarkRuleComment,
  deskmarkRuleFrontMatter,
  deskmarkRuleDateInText,
  deskmarkExtraPrefixes
} = storeToRefs(preferenceStore)
const groups = ref<DeskmarkTaskGroups | null>(null)
const progress = ref<{ seen: number, scanning: boolean } | null>(null)
let loadTicket = 0
const scanning = computed(() => progress.value ? progress.value.scanning : groups.value?.scanning === true)
const seen = computed(() => progress.value?.seen ?? groups.value?.seen ?? 0)
const query = ref('')
const order = ref<TaskOrder>('priority')
const orders: TaskOrder[] = ['priority', 'due', 'title']
const orderLabel: Record<TaskOrder, string> = {
  priority: 'sideBar.tasks.sortPriority',
  due: 'sideBar.tasks.sortDue',
  title: 'sideBar.tasks.sortTitle'
}
const editingKey = ref('')
const sentence = ref('')
const due = ref('')
const remind = ref('')
const priority = ref<'low' | 'normal' | 'high'>('normal')
const repeat = ref('none')
const currentPath = computed(() => currentFile.value?.pathname || '')
const taskIdentity = (task: DeskmarkTaskRef): string => `${task.notePath}:${task.taskKey}`

const root = computed(() => projectTree.value?.pathname || '')
const visibleGroups = computed(() => {
  const value = groups.value
  if (!value) return []
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const now = new Date()
  const next7 = value.upcoming.filter(task => calendarGroup({ done: false, due: task.due }, now, zone) === 'next7')
  const later = value.upcoming.filter(task => calendarGroup({ done: false, due: task.due }, now, zone) !== 'next7')
  return [
    { id: 'overdue', label: 'sideBar.tasks.overdue', items: value.overdue },
    { id: 'today', label: 'sideBar.tasks.today', items: value.today },
    { id: 'next7', label: 'calendar.next7', items: next7 },
    { id: 'later', label: 'calendar.later', items: later },
    { id: 'inbox', label: 'sideBar.tasks.inbox', items: value.inbox },
    { id: 'done', label: 'sideBar.tasks.done', items: value.done }
  ].map(group => ({
    ...group,
    items: sortTasks(filterTasks(group.items, query.value), order.value)
  })).filter(group => group.items.length > 0)
})
const unreadable = computed(() => {
  const items = groups.value?.unreadable ?? []
  const needle = query.value.trim().toLowerCase()
  if (!needle) return items
  return items.filter(item => item.path.toLowerCase().includes(needle))
})

const load = async (resetProgress = false): Promise<void> => {
  if (resetProgress) progress.value = null
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
  if (next && !progress.value) {
    progress.value = { seen: next.seen ?? 0, scanning: next.scanning === true }
  }
  const names = new Map<string, string>()
  const lists = [next?.inbox, next?.today, next?.upcoming, next?.overdue, next?.done]
  for (const group of lists) {
    if (!group) continue
    for (const task of group) names.set(task.notePath, task.notePath.split('/').pop() || task.notePath)
  }
  deskmarkStore.notes = [...names.entries()].map(([href, title]) => ({ title, href }))
}

watch(root, () => {
  load(true).catch((error) => {
    console.error(error)
  })
}, { immediate: true })

watch(revision, () => {
  load().catch((error) => {
    console.error(error)
  })
})

watch([
  deskmarkScanExtensions,
  deskmarkRuleTaskLine,
  deskmarkRuleComment,
  deskmarkRuleFrontMatter,
  deskmarkRuleDateInText,
  deskmarkExtraPrefixes
], () => {
  load(true).catch((error) => {
    console.error(error)
  })
})

const stopIndexTick = watchDeskmarkIndex(() => {
  load().catch((error) => {
    console.error(error)
  })
}, (tick) => {
  progress.value = { seen: tick.seen, scanning: tick.scanning }
})
onBeforeUnmount(stopIndexTick)

const openTask = (task: DeskmarkTaskRef): void => {
  deskmarkStore.select(task)
  const key = taskIdentity(task)
  if (editingKey.value === key) return
  editingKey.value = key
  sentence.value = task.text
  due.value = task.due?.slice(0, 10) ?? ''
  remind.value = task.remindAt ? task.remindAt.slice(0, 16) : ''
  priority.value = task.priority === 'low' || task.priority === 'high' ? task.priority : 'normal'
  repeat.value = task.repeat && task.repeat !== '' ? task.repeat : 'none'
}

const openNote = (task: DeskmarkTaskRef): void => {
  if (!root.value) return
  deskmarkStore.select(task)
  const fullPath = window.path.join(root.value, task.notePath)
  window.electron.ipcRenderer.send('mt::open-file', fullPath, task.line ? { deskmarkLine: task.line } : {})
}

const openUnreadable = (notePath: string): void => {
  if (!root.value) return
  if (!preferenceStore.sourceCode) {
    preferenceStore.sourceCode = true
    preferenceStore.DISPATCH_EDITOR_VIEW_STATE({ sourceCode: true })
  }
  window.electron.ipcRenderer.send('mt::open-file', window.path.join(root.value, notePath), {})
}

const save = (task: DeskmarkTaskRef): void => {
  if (!root.value || !task.line) return
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  editDeskmarkTask(root.value, task.notePath, task.line, {
    text: sentence.value.trim() || task.text,
    due: due.value || null,
    remind: remind.value ? localDateTimeToIso(remind.value, timeZone) : null,
    priority: priority.value,
    repeat: repeat.value
  }).then((next) => {
    if (next) groups.value = next
    deskmarkStore.touch()
  }).catch((error) => {
    console.error(error)
  })
}

const showOnCalendar = (task: DeskmarkTaskRef): void => {
  const day = task.due?.slice(0, 10)
  if (!day) return
  deskmarkStore.focusDay = day
  showDeskmarkTarget('calendar')
}

const toggle = (task: DeskmarkTaskRef): void => {
  if (!root.value || !task.line) return
  editDeskmarkTask(root.value, task.notePath, task.line, {
    checked: task.status !== 'done'
  }).then((next) => {
    if (next) groups.value = next
  }).catch((error) => {
    console.error(error)
  })
}

const stickCurrent = (): void => {
  if (!root.value || !currentPath.value) return
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-open', root.value, currentPath.value).catch((error) => {
    console.error(error)
  })
}
</script>

<style scoped>
.deskmark-tasks {
  padding: 12px;
}
.empty {
  margin: 0;
}
h3 {
  margin: 12px 0 6px;
  font-size: 13px;
  font-weight: 600;
}
.stick {
  margin-bottom: 8px;
}
.tools {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
  position: sticky;
  top: 0;
  z-index: 1;
  padding-bottom: 8px;
  background: var(--sideBarBgColor);
}
.tools input,
.sorts button,
.editor input,
.editor select {
  min-width: 0;
  padding: 4px 6px;
  border-radius: 4px;
  box-sizing: border-box;
}
.tools input {
  flex: 1;
  width: 100%;
}
.tools input::placeholder {
  color: color-mix(in srgb, currentColor 55%, transparent);
}
.sorts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.sorts button,
.actions button {
  padding: 3px 8px;
  border: 1px solid var(--floatBorderColor, color-mix(in srgb, currentColor 18%, transparent));
  border-radius: 4px;
  font-size: 12px;
}
.sorts button.on {
  color: var(--themeColor);
  border-color: var(--themeColor);
}
.editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 8px 22px;
}
.editor label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.editor input,
.editor select {
  width: 100%;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.calendar-link {
  margin: 0 0 8px 22px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--themeColor);
}
.unreadable-note {
  display: block;
  width: 100%;
  margin: 0 0 4px;
  padding: 3px 4px;
  border-radius: 4px;
  text-align: left;
  word-break: break-all;
}
</style>
