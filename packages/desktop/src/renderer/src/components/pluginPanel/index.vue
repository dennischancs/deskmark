<template>
  <div class="plugin-panel deskmark-ui deskmark-side">
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
import { usePreferencesStore } from '@/store/preferences'
import { noteInsideVault } from '../../../../../../deskmark-plugin/src/index.ts'

defineProps<{ closeLabel: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const editorStore = useEditorStore()
const projectStore = useProjectStore()
const preferencesStore = usePreferencesStore()
const { currentFile } = storeToRefs(editorStore)
const { projectTree } = storeToRefs(projectStore)
const { theme } = storeToRefs(preferencesStore)
const host = ref<HTMLDivElement | null>(null)
const error = ref('')
let guestView: (HTMLElement & { insertCSS?: (css: string) => Promise<string> }) | null = null

const safeColor = (value: string): string => {
  const trimmed = value.trim()
  return /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/.test(trimmed) ? trimmed : ''
}

const paintGuest = (): void => {
  if (!guestView?.insertCSS) return
  const style = getComputedStyle(document.documentElement)
  const foreground = safeColor(style.getPropertyValue('--sideBarColor'))
    || safeColor(style.getPropertyValue('--editorColor'))
  const scheme = document.documentElement.style.colorScheme === 'dark' ? 'dark' : 'light'
  const color = foreground ? `--deskmark-fg:${foreground};color:${foreground} !important;` : ''
  guestView.insertCSS(`:root{color-scheme:${scheme};${color}}html,body{background:transparent !important;${color}}`).catch(() => {})
}

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
    guestView = guest as HTMLElement & { insertCSS?: (css: string) => Promise<string> }
    guest.setAttribute('src', info.src)
    guest.setAttribute('preload', info.preload)
    guest.setAttribute('partition', 'persist:deskmark-plugin')
    guest.addEventListener('dom-ready', paintGuest)
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
watch(theme, () => {
  paintGuest()
})
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
