<template>
  <div class="plugin-panel deskmark-ui deskmark-side">
    <header class="head">
      <h2>{{ title }}</h2>
      <button
        type="button"
        class="close"
        @click="emit('close')"
      >
        {{ closeLabel }}
      </button>
    </header>
    <section
      v-if="!guestReady"
      class="summary"
    >
      <p class="value">
        {{ reading.value }} <span class="unit">{{ reading.unit }}</span>
      </p>
      <div
        v-for="row of reading.rows"
        :key="row.name"
        class="row"
      >
        <span>{{ row.name }}</span>
        <span>{{ row.value }}</span>
      </div>
      <p
        v-if="reading.path"
        class="path"
      >
        {{ reading.path }}
      </p>
      <p
        v-if="reading.hint"
        class="hint"
      >
        {{ reading.hint }}
      </p>
    </section>
    <p v-if="error">
      {{ error }}
    </p>
    <div
      v-else
      ref="host"
      class="guest"
      :class="{ pending: !guestReady }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import { useProjectStore } from '@/store/project'
import { usePreferencesStore } from '@/store/preferences'
import { noteInsideVault } from '../../../../../../deskmark-plugin/src/index.ts'
import { presentNote } from '../../../../../../../plugins/sample-wordcount/measure.mjs'

defineProps<{ closeLabel: string, title: string }>()
const emit = defineEmits<{ close: [] }>()
const { t, locale } = useI18n()
const editorStore = useEditorStore()
const projectStore = useProjectStore()
const preferencesStore = usePreferencesStore()
const { currentFile } = storeToRefs(editorStore)
const { projectTree } = storeToRefs(projectStore)
const { theme } = storeToRefs(preferencesStore)
const host = ref<HTMLDivElement | null>(null)
const error = ref('')
const guestReady = ref(false)
let guestView: (HTMLElement & { insertCSS?: (css: string) => Promise<string> }) | null = null

const reading = computed(() => {
  const lang = String(locale.value || 'en')
  const root = projectTree.value?.pathname || ''
  const file = currentFile.value
  if (!root || !file?.pathname) return presentNote({ lang, state: 'empty' })
  const href = window.path.relative(root, file.pathname).replaceAll('\\', '/')
  if (!noteInsideVault(href)) return presentNote({ lang, state: 'empty' })
  return presentNote({
    markdown: file.markdown || '',
    path: href,
    lang,
    state: 'ready'
  })
})

const safeColor = (value: string): string => {
  const trimmed = value.trim()
  return /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/.test(trimmed) ? trimmed : ''
}

const paintGuest = (): void => {
  if (!guestView?.insertCSS) return
  const style = getComputedStyle(document.documentElement)
  const foreground = safeColor(style.getPropertyValue('--sideBarColor')) ||
    safeColor(style.getPropertyValue('--editorColor'))
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

const guestSource = (src: string): string => {
  const url = new URL(src)
  url.searchParams.set('lang', String(locale.value || 'en'))
  const foreground = foregroundColor()
  if (foreground) url.searchParams.set('fg', foreground)
  return url.href
}

const foregroundColor = (): string => {
  const style = getComputedStyle(document.documentElement)
  return safeColor(style.getPropertyValue('--sideBarColor')) ||
    safeColor(style.getPropertyValue('--editorColor'))
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
    guest.setAttribute('src', guestSource(info.src))
    guest.setAttribute('preload', info.preload)
    guest.setAttribute('partition', 'persist:deskmark-plugin')
    guest.addEventListener('dom-ready', () => {
      guestReady.value = true
      paintGuest()
      publish()
    })
    guest.addEventListener('did-fail-load', () => {
      guestReady.value = false
    })
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
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 0 12px;
}
.head h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.summary {
  padding: 4px 12px 12px;
}
.value {
  margin: 4px 0 12px;
  font-size: 32px;
  font-weight: 600;
  line-height: 1.1;
}
.unit,
.path,
.hint {
  font-size: 13px;
  font-weight: 500;
  opacity: 0.72;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  border-top: 1px solid color-mix(in srgb, currentColor 16%, transparent);
}
.path,
.hint {
  margin: 10px 0 0;
  word-break: break-all;
}
.guest,
.guest webview {
  flex: 1;
  width: 100%;
  height: 100%;
  border: 0;
}
.guest.pending {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
}
</style>
