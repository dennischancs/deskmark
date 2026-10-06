<template>
  <div class="plugin-panel">
    <button
      type="button"
      class="close"
      @click="emit('close')"
    >
      {{ closeLabel }}
    </button>
    <p v-if="error">
      {{ error }}
    </p>
    <div
      v-else
      ref="host"
      class="guest"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import { useProjectStore } from '@/store/project'
import { noteInsideVault } from '../../../../../../deskmark-plugin/src/index.ts'

defineProps<{ closeLabel: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const editorStore = useEditorStore()
const projectStore = useProjectStore()
const { currentFile } = storeToRefs(editorStore)
const { projectTree } = storeToRefs(projectStore)
const host = ref<HTMLDivElement | null>(null)
const error = ref('')

const publish = (): void => {
  const root = projectTree.value?.pathname || ''
  const file = currentFile.value
  if (!root || !file?.pathname) {
    window.electron.ipcRenderer.invoke('mt::deskmark::plugin-note', null).catch(() => {})
    return
  }
  const href = window.path.relative(root, file.pathname).replaceAll('\\', '/')
  if (!noteInsideVault(href)) {
    window.electron.ipcRenderer.invoke('mt::deskmark::plugin-note', null).catch(() => {})
    return
  }
  window.electron.ipcRenderer.invoke('mt::deskmark::plugin-note', {
    vault: root,
    path: href,
    markdown: file.markdown || ''
  }).catch(() => {})
}

onMounted(async () => {
  try {
    const info = await window.electron.ipcRenderer.invoke('mt::deskmark::plugin-info')
    if (!info || !host.value) {
      error.value = t('plugin.failed')
      return
    }
    const guest = document.createElement('webview')
    guest.setAttribute('src', info.src)
    guest.setAttribute('preload', info.preload)
    guest.setAttribute('partition', 'persist:deskmark-plugin')
    host.value.appendChild(guest)
    publish()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : t('plugin.failed')
  }
})

onBeforeUnmount(() => {
  window.electron.ipcRenderer.invoke('mt::deskmark::plugin-note', null).catch(() => {})
})

watch([currentFile, projectTree], publish)
</script>

<style scoped>
.plugin-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
.plugin-panel .close {
  align-self: flex-end;
}
.guest,
.guest webview {
  flex: 1;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
