<template>
  <div class="pref-deskmark">
    <h4>{{ t('preferences.deskmark.title') }}</h4>
    <compound :notes="t('preferences.deskmark.detail')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.deskmark.features') }}
        </h6>
      </template>
      <template #children>
        <bool
          :description="t('preferences.deskmark.calendar')"
          :bool="deskmarkCalendar"
          :on-change="(value) => onSelectChange('deskmarkCalendar', value)"
        />
        <bool
          :description="t('preferences.deskmark.tasks')"
          :bool="deskmarkTasks"
          :on-change="(value) => onSelectChange('deskmarkTasks', value)"
        />
        <bool
          :description="t('preferences.deskmark.reminders')"
          :bool="deskmarkReminders"
          :notes="t('preferences.deskmark.reminderLimit')"
          :on-change="(value) => onSelectChange('deskmarkReminders', value)"
        />
        <label class="scan-label">
          {{ t('preferences.deskmark.reminderSeconds') }}
          <input
            class="scan-text seconds"
            type="number"
            min="1"
            max="600"
            step="1"
            :value="deskmarkReminderSeconds"
            @change="setSeconds(($event.target as HTMLInputElement).value)"
          >
        </label>
        <p class="seconds-hint">{{ t('preferences.deskmark.reminderSecondsHint') }}</p>
        <label class="scan-label">
          {{ t('preferences.deskmark.captureShortcut') }}
          <input
            class="scan-text"
            type="text"
            :value="deskmarkCaptureAccelerator"
            @change="setShortcut(($event.target as HTMLInputElement).value)"
          >
        </label>
        <p class="seconds-hint">
          {{ t('preferences.deskmark.captureShortcutHint') }}
        </p>
        <h6 class="title">
          {{ t('preferences.deskmark.stickyDir') }}
        </h6>
        <p class="seconds-hint">
          {{ t('preferences.deskmark.stickyDirHint') }}
        </p>
        <label class="scan-label">
          {{ t('preferences.deskmark.stickyDir') }}
          <input
            class="scan-text"
            type="text"
            :value="deskmarkStickyDir"
            @change="setStickyDir(($event.target as HTMLInputElement).value)"
          >
        </label>
        <div class="plugin-actions">
          <button
            type="button"
            @click="pickStickyDir"
          >
            {{ t('preferences.deskmark.stickyDirPick') }}
          </button>
          <button
            type="button"
            @click="setStickyDir('')"
          >
            {{ t('preferences.deskmark.stickyDirReset') }}
          </button>
        </div>
        <h6 class="title">
          {{ t('preferences.deskmark.pluginSettings') }}
        </h6>
        <p class="seconds-hint">
          {{ t('preferences.deskmark.pluginSettingsHint') }}
        </p>
        <label class="scan-label">
          {{ t('preferences.deskmark.pluginPath') }}
          <input
            class="scan-text"
            type="text"
            :value="deskmarkPluginPath"
            @change="setPluginPath(($event.target as HTMLInputElement).value)"
          >
        </label>
        <div class="plugin-actions">
          <button
            type="button"
            @click="pickPlugin"
          >
            {{ t('preferences.deskmark.pluginPick') }}
          </button>
          <button
            type="button"
            @click="unloadPlugin"
          >
            {{ t('preferences.deskmark.pluginUnload') }}
          </button>
        </div>
        <p class="seconds-hint">
          {{ pluginStatus }}
        </p>
        <p
          v-for="item of pluginSettings"
          :key="item.id"
          class="seconds-hint"
        >
          {{ item.title }}
        </p>
        <bool
          :description="t('preferences.deskmark.wordCount')"
          :bool="deskmarkWordCount"
          :on-change="(value) => onSelectChange('deskmarkWordCount', value)"
        />
        <bool
          :description="t('preferences.deskmark.openAtLogin')"
          :bool="openAtLogin"
          :on-change="setLogin"
        />
      </template>
    </compound>
    <compound :notes="t('preferences.deskmark.extensionsHint')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.deskmark.extensions') }}
        </h6>
      </template>
      <template #children>
        <div class="ext-list">
          <label
            v-for="ext of knownExtensions"
            :key="ext"
          >
            <input
              type="checkbox"
              :checked="extensionOn(ext)"
              @change="toggleExtension(ext, ($event.target as HTMLInputElement).checked)"
            >
            .{{ ext }}
          </label>
        </div>
        <input
          class="scan-text"
          type="text"
          :value="deskmarkScanExtensions"
          @change="setText('deskmarkScanExtensions', ($event.target as HTMLInputElement).value)"
        >
      </template>
    </compound>
    <compound :notes="t('preferences.deskmark.rulesHint')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.deskmark.rules') }}
        </h6>
      </template>
      <template #children>
        <bool
          :description="t('preferences.deskmark.ruleTask')"
          :bool="deskmarkRuleTaskLine"
          :on-change="(value) => onSelectChange('deskmarkRuleTaskLine', value)"
        />
        <bool
          :description="t('preferences.deskmark.ruleComment')"
          :bool="deskmarkRuleComment"
          :on-change="(value) => onSelectChange('deskmarkRuleComment', value)"
        />
        <bool
          :description="t('preferences.deskmark.ruleFront')"
          :bool="deskmarkRuleFrontMatter"
          :on-change="(value) => onSelectChange('deskmarkRuleFrontMatter', value)"
        />
        <bool
          :description="t('preferences.deskmark.ruleDate')"
          :bool="deskmarkRuleDateInText"
          :on-change="(value) => onSelectChange('deskmarkRuleDateInText', value)"
        />
        <label class="scan-label">
          {{ t('preferences.deskmark.extraPrefixes') }}
          <input
            class="scan-text"
            type="text"
            :value="deskmarkExtraPrefixes"
            :placeholder="t('preferences.deskmark.extraPrefixesHint')"
            @change="setText('deskmarkExtraPrefixes', ($event.target as HTMLInputElement).value)"
          >
        </label>
      </template>
    </compound>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import type { PreferencesState } from '@/store/preferences'
import Compound from '../common/compound/index.vue'
import Bool from '../common/bool/index.vue'
import { normalizeReminderSeconds } from 'common/reminderSeconds'
import { normalizeCaptureAccelerator } from 'common/captureShortcut'
import { normalizeExtensions, PLAIN_TEXT_EXTENSIONS } from '../../../../../../deskmark-core/src/extensions.ts'
import { PluginHost, readManifest, type PluginManifest } from '../../../../../../deskmark-plugin/src/index.ts'

const { t } = useI18n()
const preferenceStore = usePreferencesStore()
const {
  deskmarkCalendar,
  deskmarkTasks,
  deskmarkReminders,
  deskmarkReminderSeconds,
  deskmarkCaptureAccelerator,
  deskmarkWordCount,
  deskmarkScanExtensions,
  deskmarkRuleTaskLine,
  deskmarkRuleComment,
  deskmarkRuleFrontMatter,
  deskmarkRuleDateInText,
  deskmarkExtraPrefixes,
  deskmarkPluginPath,
  deskmarkStickyDir
} =
  storeToRefs(preferenceStore)
const openAtLogin = ref(false)
const pluginStatus = ref('')
const knownExtensions = PLAIN_TEXT_EXTENSIONS
const pluginSettings = computed(() => {
  const host = new PluginHost()
  const manifest: PluginManifest = {
    id: 'wordcount',
    name: 'Word count',
    api: 1,
    entry: 'index.html',
    permissions: ['notes.read', 'ui.command', 'ui.panel', 'settings']
  }
  try {
    host.load(readManifest(manifest), {
      settings: [{ id: 'panel', title: t('plugin.words') }]
    })
  } catch {
    return []
  }
  return host.settings().filter(item => !item.builtin)
})

onMounted(() => {
  window.electron.ipcRenderer.invoke('mt::deskmark::login-get').then((enabled) => {
    openAtLogin.value = enabled === true
  }).catch(() => {})
  loadPlugin(deskmarkPluginPath.value || '').catch(() => {})
})

const onSelectChange = (type: keyof PreferencesState, value: boolean): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}

const setText = (type: 'deskmarkScanExtensions' | 'deskmarkExtraPrefixes', value: string): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}

const showPluginResult = (result: { ok: true, active: boolean, manifest?: { name: string } } | { ok: false, error: string } | null): void => {
  if (!result || (result.ok && !result.active)) {
    pluginStatus.value = t('preferences.deskmark.pluginNone')
    return
  }
  if (!result.ok) {
    pluginStatus.value = t('preferences.deskmark.pluginFailed', { error: result.error })
    return
  }
  pluginStatus.value = t('preferences.deskmark.pluginLoaded', { name: result.manifest?.name || '' })
}

const loadPlugin = async (dir: string): Promise<void> => {
  const result = await window.electron.ipcRenderer.invoke('mt::deskmark::plugin-load', dir || null)
  showPluginResult(result)
}

const setPluginPath = (value: string): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type: 'deskmarkPluginPath', value })
  loadPlugin(value).catch(() => {
    pluginStatus.value = t('preferences.deskmark.pluginFailed', { error: t('plugin.failed') })
  })
}

const pickPlugin = (): void => {
  window.electron.ipcRenderer.invoke('mt::deskmark::pick-plugin-dir').then((dir) => {
    if (!dir) return
    setPluginPath(dir)
  }).catch(() => {
    pluginStatus.value = t('preferences.deskmark.pluginFailed', { error: t('plugin.failed') })
  })
}

const unloadPlugin = (): void => {
  setPluginPath('')
}

const setSeconds = (value: string): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type: 'deskmarkReminderSeconds', value: normalizeReminderSeconds(value) })
}

const setShortcut = (value: string): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type: 'deskmarkCaptureAccelerator', value: normalizeCaptureAccelerator(value) })
}

const setStickyDir = (value: string): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type: 'deskmarkStickyDir', value: value.trim() })
}

const pickStickyDir = (): void => {
  window.electron.ipcRenderer.invoke('mt::deskmark::pick-sticky-dir').then((dir) => {
    if (dir) setStickyDir(dir)
  }).catch(() => {})
}

const extensionOn = (ext: string): boolean => normalizeExtensions(deskmarkScanExtensions.value).includes(ext)

const toggleExtension = (ext: string, checked: boolean): void => {
  const next = new Set(normalizeExtensions(deskmarkScanExtensions.value))
  if (checked) next.add(ext)
  else next.delete(ext)
  preferenceStore.SET_SINGLE_PREFERENCE({ type: 'deskmarkScanExtensions', value: [...next].join(',') })
}

const setLogin = (enabled: boolean): void => {
  openAtLogin.value = enabled
  window.electron.ipcRenderer.invoke('mt::deskmark::login-set', enabled).then((next) => {
    openAtLogin.value = next === true
  }).catch(() => {
    openAtLogin.value = !enabled
  })
}
</script>

<style scoped>
.ext-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin: 8px 0;
}
.ext-list label,
.scan-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--editorColor);
}
.scan-text {
  width: 100%;
  margin: 6px 0 10px;
  box-sizing: border-box;
  color: var(--editorColor);
  background: var(--editorBgColor);
  border: 1px solid var(--editorColor30, var(--tableBorderColor));
  border-radius: 4px;
  padding: 4px 8px;
}
.seconds {
  width: 6em;
  margin-left: 8px;
}
.seconds-hint {
  margin: 0 0 8px;
  color: var(--editorColor60, var(--editorColor));
}
.ext-list input[type='checkbox'] {
  accent-color: var(--themeColor);
}
.plugin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 8px;
}
.plugin-actions button {
  color: inherit;
  background: transparent;
  border: 1px solid var(--floatBorderColor, color-mix(in srgb, currentColor 18%, transparent));
  border-radius: 4px;
  padding: 3px 8px;
}
</style>
