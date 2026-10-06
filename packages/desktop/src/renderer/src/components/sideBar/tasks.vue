<template>
  <div class="deskmark-tasks">
    <p
      v-if="!root"
      class="empty"
    >
      {{ t('sideBar.tasks.empty') }}
    </p>
    <section
      v-for="group of visibleGroups"
      :key="group.id"
    >
      <h3>{{ t(group.label) }}</h3>
      <div
        v-for="task of group.items"
        :key="`${task.notePath}:${task.taskKey}`"
        class="task-row"
      >
        <input
          type="checkbox"
          :checked="task.status === 'done'"
          @change="toggle(task)"
        >
        <button
          type="button"
          @click="openTask(task)"
        >
          {{ task.text }}
        </button>
      </div>
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
import type { DeskmarkTaskGroups, DeskmarkTaskRef } from '@shared/types/ipc'

const { t } = useI18n()
const projectStore = useProjectStore()
const deskmarkStore = useDeskmarkStore()
const { projectTree } = storeToRefs(projectStore)
const { revision } = storeToRefs(deskmarkStore)
const groups = ref<DeskmarkTaskGroups | null>(null)

const root = computed(() => projectTree.value?.pathname || '')
const visibleGroups = computed(() => {
  const value = groups.value
  if (!value) return []
  return [
    { id: 'overdue', label: 'sideBar.tasks.overdue', items: value.overdue },
    { id: 'today', label: 'sideBar.tasks.today', items: value.today },
    { id: 'upcoming', label: 'sideBar.tasks.upcoming', items: value.upcoming },
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
</script>

<style scoped>
.deskmark-tasks {
  padding: 12px;
  color: var(--sideBarColor);
}
.empty {
  margin: 0;
}
h3 {
  margin: 12px 0 6px;
  font-size: 13px;
  font-weight: 600;
}
button {
  display: block;
  width: auto;
  flex: 1;
  margin: 0 0 4px;
  padding: 4px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
input {
  margin: 0 6px 0 0;
}
.task-row {
  display: flex;
  align-items: center;
}
button:hover {
  background: var(--sideBarItemHoverBgColor);
}
</style>
