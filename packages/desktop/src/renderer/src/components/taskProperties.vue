<template>
  <aside
    v-if="selected && selected.line"
    class="task-properties"
  >
    <h2>{{ selected.text }}</h2>
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
    <button
      type="button"
      @click="save"
    >
      {{ t('sideBar.tasks.save') }}
    </button>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useDeskmarkStore } from '@/store/deskmark'
import { useProjectStore } from '@/store/project'
import { editDeskmarkTask } from '@/util/deskmarkEdit'
import { localDateTimeToIso } from '../../../../../deskmark-core/src/time.ts'

const { t } = useI18n()
const deskmarkStore = useDeskmarkStore()
const projectStore = useProjectStore()
const { selected } = storeToRefs(deskmarkStore)
const { projectTree } = storeToRefs(projectStore)
const due = ref('')
const remind = ref('')
const priority = ref<'low' | 'normal' | 'high'>('normal')
const repeat = ref('none')

watch(selected, (task) => {
  due.value = task?.due?.slice(0, 10) ?? ''
  remind.value = task?.remindAt ? task.remindAt.slice(0, 16) : ''
  priority.value = task?.priority === 'low' || task?.priority === 'high' ? task.priority : 'normal'
  repeat.value = task?.repeat && task.repeat !== '' ? task.repeat : 'none'
})

const save = async (): Promise<void> => {
  const task = selected.value
  const root = projectTree.value?.pathname
  if (!task?.line || !root) return
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const groups = await editDeskmarkTask(root, task.notePath, task.line, {
    due: due.value || null,
    remind: remind.value ? localDateTimeToIso(remind.value, timeZone) : null,
    priority: priority.value,
    repeat: repeat.value
  })
  if (groups) deskmarkStore.touch()
}
</script>

<style scoped>
.task-properties {
  width: 240px;
  flex: 0 0 240px;
  padding: 16px 12px;
  border-left: 1px solid var(--itemBgColor);
  background: var(--sideBarBgColor);
  color: var(--sideBarColor);
  overflow: auto;
}
h2 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}
label {
  display: block;
  margin: 0 0 10px;
  font-size: 12px;
}
input,
select,
button {
  display: block;
  width: 100%;
  margin-top: 4px;
  box-sizing: border-box;
}
button {
  margin-top: 12px;
}
</style>
