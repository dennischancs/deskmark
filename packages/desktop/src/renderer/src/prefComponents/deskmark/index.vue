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
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/store/preferences'
import type { PreferencesState } from '@/store/preferences'
import Compound from '../common/compound/index.vue'
import Bool from '../common/bool/index.vue'
import { MARKDOWN_EXTENSIONS } from 'common/filesystem/paths'
import { normalizeExtensions } from '../../../../../../deskmark-core/src/extract.ts'

const { t } = useI18n()
const preferenceStore = usePreferencesStore()
const {
  deskmarkCalendar,
  deskmarkTasks,
  deskmarkReminders,
  deskmarkWordCount,
  deskmarkScanExtensions,
  deskmarkRuleTaskLine,
  deskmarkRuleComment,
  deskmarkRuleFrontMatter,
  deskmarkRuleDateInText,
  deskmarkExtraPrefixes
} =
  storeToRefs(preferenceStore)
const openAtLogin = ref(false)
const knownExtensions = MARKDOWN_EXTENSIONS

onMounted(() => {
  window.electron.ipcRenderer.invoke('mt::deskmark::login-get').then((enabled) => {
    openAtLogin.value = enabled === true
  }).catch(() => {})
})

const onSelectChange = (type: keyof PreferencesState, value: boolean): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}

const setText = (type: 'deskmarkScanExtensions' | 'deskmarkExtraPrefixes', value: string): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
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
}
.scan-text {
  width: 100%;
  margin: 6px 0 10px;
  box-sizing: border-box;
}
</style>
