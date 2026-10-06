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
      <button
        v-for="task of group.items"
        :key="`${task.notePath}:${task.taskKey}`"
        type="button"
        @click="openTask(task)"
      >
        {{ task.text }}
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/store/project'
import type { DeskmarkTaskGroups, DeskmarkTaskRef } from '@shared/types/ipc'

const { t } = useI18n()
const projectStore = useProjectStore()
const { projectTree } = storeToRefs(projectStore)
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

const openTask = (task: DeskmarkTaskRef): void => {
  const fullPath = window.path.join(root.value, task.notePath)
  window.electron.ipcRenderer.send('mt::open-file', fullPath, {})
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
  width: 100%;
  margin: 0 0 4px;
  padding: 4px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
button:hover {
  background: var(--sideBarItemHoverBgColor);
}
</style>
