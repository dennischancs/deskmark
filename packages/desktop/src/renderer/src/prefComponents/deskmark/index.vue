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

const { t } = useI18n()
const preferenceStore = usePreferencesStore()
const { deskmarkCalendar, deskmarkTasks, deskmarkReminders, deskmarkWordCount } =
  storeToRefs(preferenceStore)
const openAtLogin = ref(false)

onMounted(() => {
  window.electron.ipcRenderer.invoke('mt::deskmark::login-get').then((enabled) => {
    openAtLogin.value = enabled === true
  }).catch(() => {})
})

const onSelectChange = (type: keyof PreferencesState, value: boolean): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
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
