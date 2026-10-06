<template>
  <div class="deskmark-tasks deskmark-ui deskmark-side">
    <p
      v-if="!root"
      class="empty"
    >
      {{ t('sideBar.tasks.empty') }}
    </p>
    <button
        class="deskmark-hover stick"
      v-if="currentPath"
      type="button"
      @click="stickCurrent"
    >
      {{ t('sticky.open') }}
    </button>
    <section
      v-for="group of visibleGroups"
      :key="group.id"
    >
      <h3>{{ t(group.label) }}</h3>
      <task-line
        v-for="task of group.items"
        :key="`${task.notePath}:${task.taskKey}`"
        :task="task"
        @open="openTask"
        @toggle="toggle"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/store/project'
import { useEditorStore } from '@/store/editor'
import { useDeskmarkStore } from '@/store/deskmark'
import { editDeskmarkTask } from '@/util/deskmarkEdit'
import TaskLine from '@/components/taskLine.vue'
import { calendarGroup } from '../../../../../../deskmark-core/src/agenda.ts'
import type { DeskmarkTaskGroups, DeskmarkTaskRef } from '@shared/types/ipc'

const { t } = useI18n()
const projectStore = useProjectStore()
const deskmarkStore = useDeskmarkStore()
const editorStore = useEditorStore()
const { projectTree } = storeToRefs(projectStore)
const { revision } = storeToRefs(deskmarkStore)
const { currentFile } = storeToRefs(editorStore)
const groups = ref<DeskmarkTaskGroups | null>(null)
const currentPath = computed(() => currentFile.value?.pathname || '')

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
  ].filter(group => group.items.length > 0)
})

const load = async (): Promise<void> => {
  if (!root.value) {
    groups.value = null
    return
  }
  groups.value = await window.electron.ipcRenderer.invoke('mt::deskmark::tasks', root.value)
  const names = new Map<string, string>()
  for (const group of Object.values(groups.value ?? {})) {
    for (const task of group) names.set(task.notePath, task.notePath.split('/').pop() || task.notePath)
  }
  deskmarkStore.notes = [...names.entries()].map(([href, title]) => ({ title, href }))
}

watch(root, () => {
  load().catch((error) => {
    console.error(error)
  })
}, { immediate: true })

watch(revision, () => {
  load().catch((error) => {
    console.error(error)
  })
})

const openTask = (task: DeskmarkTaskRef): void => {
  deskmarkStore.select(task)
  const fullPath = window.path.join(root.value, task.notePath)
  window.electron.ipcRenderer.send('mt::open-file', fullPath, task.line ? { deskmarkLine: task.line } : {})
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
</style>
