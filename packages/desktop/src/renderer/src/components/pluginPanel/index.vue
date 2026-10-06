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
    <iframe
      v-else-if="src"
      ref="frame"
      :src="src"
      sandbox="allow-scripts"
      title="plugin"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store/editor'
import { authorize, noteInsideVault, readManifest, type PluginManifest } from '../../../../../../deskmark-plugin/src/index.ts'

const { t } = useI18n()
const props = defineProps<{ root: string, entry: string, manifest: PluginManifest, closeLabel: string }>()
const emit = defineEmits<{ close: [] }>()
const editorStore = useEditorStore()
const { currentFile } = storeToRefs(editorStore)
const frame = ref<HTMLIFrameElement | null>(null)
const src = ref('')
const error = ref('')

const relativeNote = (): string | null => {
  const file = currentFile.value
  if (!file?.pathname || !props.root) return null
  const href = window.path.relative(props.root, file.pathname).replaceAll('\\', '/')
  return noteInsideVault(href) ? href : null
}

const reply = (id: string, ok: boolean, result?: unknown, message?: string): void => {
  frame.value?.contentWindow?.postMessage({ id, ok, result, error: message }, '*')
}

const onMessage = (event: MessageEvent): void => {
  if (event.source !== frame.value?.contentWindow) return
  const data = event.data as { id?: string, method?: string, path?: string, markdown?: string }
  if (!data?.id || !data.method) return
  try {
    const permission = authorize(props.manifest, data.method)
    if (permission === 'notes.read') {
      const href = data.path || relativeNote()
      if (!href || !noteInsideVault(href)) throw new Error('这个小功能没有得到相应允许')
      const file = currentFile.value
      const same = file?.pathname && window.path.relative(props.root, file.pathname).replaceAll('\\', '/') === href
      reply(data.id, true, { path: href, markdown: same ? file?.markdown || '' : '' })
      return
    }
    reply(data.id, true, { accepted: true })
  } catch (caught) {
    reply(data.id, false, undefined, caught instanceof Error ? caught.message : t('plugin.failed'))
  }
}

onMounted(() => {
  try {
    readManifest(props.manifest)
    src.value = window.path.join(props.root, props.entry)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : t('plugin.failed')
  }
  window.addEventListener('message', onMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
})

watch(currentFile, () => {
  frame.value?.contentWindow?.postMessage({ type: 'note-changed' }, '*')
})
</script>

<style scoped>
.plugin-panel,
.plugin-panel {
  display: flex;
  flex-direction: column;
}
.plugin-panel .close {
  align-self: flex-end;
}
.plugin-panel iframe {
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
}
</style>
