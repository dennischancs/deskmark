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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import { useProjectStore } from '@/store/project'
import { noteInsideVault } from '../../../../../../deskmark-plugin/src/index.ts'
import { presentNote } from '../../../../../../../plugins/sample-wordcount/measure.mjs'

defineProps<{ closeLabel: string, title: string }>()
const emit = defineEmits<{ close: [] }>()
const { locale } = useI18n()
const editorStore = useEditorStore()
const projectStore = useProjectStore()
const { currentFile } = storeToRefs(editorStore)
const { projectTree } = storeToRefs(projectStore)

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
</style>
