<template>
  <div
    class="task-row"
    :class="{ done: task.status === 'done' }"
    :draggable="task.status !== 'done' && task.line != null"
    @dragstart="onDrag"
    @dragend="endTaskDrag"
  >
    <input
      type="checkbox"
      :checked="task.status === 'done'"
      @change="emit('toggle', task)"
    >
    <button
      type="button"
      class="deskmark-hover"
      @click="emit('open', task)"
    >
      <span class="text">{{ task.text }}</span>
      <span class="meta">{{ meta }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeskmarkTaskRef } from '@shared/types/ipc'
import { beginTaskDrag, endTaskDrag } from '@/util/taskDrag'

const props = defineProps<{ task: DeskmarkTaskRef }>()
const emit = defineEmits<{ open: [task: DeskmarkTaskRef], toggle: [task: DeskmarkTaskRef] }>()
const { t } = useI18n()

const onDrag = (event: DragEvent): void => {
  beginTaskDrag(props.task.taskKey, props.task.line, props.task.status, event)
}

const meta = computed(() => {
  const note = props.task.notePath.split('/').pop() || props.task.notePath
  const parts = [note]
  if (props.task.priority === 'high') parts.push(t('sideBar.tasks.high'))
  if (props.task.priority === 'low') parts.push(t('sideBar.tasks.low'))
  if (props.task.repeat === 'daily') parts.push(t('sideBar.tasks.daily'))
  if (props.task.repeat === 'weekly') parts.push(t('sideBar.tasks.weekly'))
  if (props.task.repeat === 'monthly') parts.push(t('sideBar.tasks.monthly'))
  return parts.join(' / ')
})
</script>

<style scoped>
.task-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.task-row[draggable='true'] {
  cursor: grab;
}
input {
  margin: 6px 0 0;
}
button {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  border-radius: 4px;
  text-align: left;
  cursor: pointer;
}
.text,
.meta {
  display: block;
}
.meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--sideBarTextColor, var(--editorColor50, color-mix(in srgb, var(--editorColor) 55%, transparent)));
}
.done .text {
  opacity: 0.55;
  text-decoration: line-through;
}
</style>
