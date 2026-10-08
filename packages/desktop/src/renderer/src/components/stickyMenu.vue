<template>
  <button
    ref="triggerRef"
    type="button"
    class="sticky-menu-trigger"
    data-testid="sticky-menu-trigger"
    :aria-expanded="open"
    aria-haspopup="menu"
    @click="toggle"
  >
    <span class="bars" />
    {{ t('sticky.menu') }}
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      class="sticky-menu-host"
    >
      <div
        class="sticky-menu-scrim"
        @pointerdown="close"
      />
      <div
        ref="panelRef"
        class="sticky-menu deskmark-ui"
        data-testid="sticky-menu"
        role="menu"
        tabindex="-1"
        :aria-label="t('sticky.menu')"
        :style="panelStyle"
      >
        <button
          type="button"
          role="menuitem"
          @click="choose('settings')"
        >
          {{ t('sticky.settings') }}
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="sticky-menu-lock"
          :aria-expanded="lockOpen"
          @click="lockOpen = !lockOpen"
        >
          {{ t('sticky.lockMenu') }}
        </button>
        <div
          v-if="lockOpen"
          class="sticky-menu-sub"
          data-testid="sticky-menu-lock-list"
        >
          <label>
            <input
              type="checkbox"
              :checked="locked"
              @change="emit('lock', !locked)"
            >
            {{ t('sticky.lock') }}
          </label>
          <label>
            <input
              type="checkbox"
              :checked="pass"
              @change="emit('pass', !pass)"
            >
            {{ t('sticky.pass') }}
          </label>
          <label>
            <input
              type="checkbox"
              :checked="bottom"
              @change="emit('bottom', !bottom)"
            >
            {{ t('sticky.bottom') }}
          </label>
        </div>
        <label>
          <input
            type="checkbox"
            :checked="pinned"
            @change="emit('pin', !pinned)"
          >
          {{ t('sticky.top') }}
        </label>
        <label>
          <input
            type="checkbox"
            :checked="edgeHide"
            @change="emit('edge', !edgeHide)"
          >
          {{ t('sticky.edgeHide') }}
        </label>
        <button
          type="button"
          role="menuitem"
          data-testid="sticky-menu-main"
          @click="choose('main')"
        >
          {{ t('sticky.openMain') }}
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="sticky-menu-close"
          @click="choose('close')"
        >
          {{ t('sticky.close') }}
        </button>
        <button
          type="button"
          role="menuitem"
          data-testid="sticky-menu-others"
          :aria-expanded="othersOpen"
          @click="toggleOthers"
        >
          {{ t('sticky.others') }}
        </button>
        <div
          v-if="othersOpen"
          class="sticky-menu-sub"
          data-testid="sticky-menu-other-list"
        >
          <p v-if="others.length === 0">
            {{ t('sticky.only') }}
          </p>
          <button
            v-for="note of others"
            :key="note.path"
            type="button"
            role="menuitem"
            @click="emit('show', note.path); close()"
          >
            {{ note.name }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { placeStickyPalette } from 'common/stickyPalette'

defineProps<{
  pinned: boolean
  edgeHide: boolean
  locked: boolean
  pass: boolean
  bottom: boolean
  others: { path: string, name: string }[]
}>()

const emit = defineEmits<{
  pin: [value: boolean]
  edge: [value: boolean]
  lock: [value: boolean]
  pass: [value: boolean]
  bottom: [value: boolean]
  settings: []
  close: []
  main: []
  show: [path: string]
  others: []
}>()

const { t } = useI18n()
const open = ref(false)
const lockOpen = ref(false)
const othersOpen = ref(false)
const place = ref({ left: 8, top: 8 })
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = computed(() => ({
  top: `${place.value.top}px`,
  left: `${place.value.left}px`
}))

const layout = (): void => {
  const trigger = triggerRef.value
  const panel = panelRef.value
  if (!trigger || !panel) return
  const button = trigger.getBoundingClientRect()
  const box = panel.getBoundingClientRect()
  place.value = placeStickyPalette(
    { left: button.left, top: button.top, width: button.width, height: button.height },
    { width: box.width, height: box.height },
    { width: window.innerWidth, height: window.innerHeight }
  )
}

const onKey = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') close()
}

const toggle = (): void => {
  open.value = !open.value
}

const close = (): void => {
  open.value = false
  lockOpen.value = false
  othersOpen.value = false
}

const choose = (kind: 'settings' | 'close' | 'main'): void => {
  if (kind === 'settings') emit('settings')
  else if (kind === 'main') emit('main')
  else emit('close')
  close()
}

const toggleOthers = (): void => {
  othersOpen.value = !othersOpen.value
  if (othersOpen.value) emit('others')
  nextTick(() => layout()).catch((error) => {
    console.error(error)
  })
}

watch(open, (value) => {
  if (value) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
  if (!value) return
  nextTick(() => {
    layout()
    panelRef.value?.focus()
  }).catch((error) => {
    console.error(error)
  })
})

watch([lockOpen, othersOpen], () => {
  if (!open.value) return
  nextTick(() => layout()).catch((error) => {
    console.error(error)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.sticky-menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border: 1px solid var(--floatBorderColor, color-mix(in srgb, var(--editorColor) 25%, transparent));
  border-radius: 4px;
  background: transparent;
  color: var(--editorColor);
  font-size: 12px;
}

.sticky-menu-trigger[aria-expanded='true'] {
  outline: 2px solid var(--themeColor);
  outline-offset: 1px;
}

.bars,
.bars::before,
.bars::after {
  display: block;
  width: 12px;
  height: 2px;
  background: currentColor;
}

.bars {
  position: relative;
}

.bars::before,
.bars::after {
  content: '';
  position: absolute;
  left: 0;
}

.bars::before {
  top: -4px;
}

.bars::after {
  top: 4px;
}

.sticky-menu-scrim {
  position: fixed;
  inset: 0;
  z-index: 10000;
}

.sticky-menu {
  position: fixed;
  z-index: 10001;
  min-width: 168px;
  max-height: calc(100vh - 16px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--floatBorderColor, color-mix(in srgb, var(--editorColor) 25%, transparent));
  border-radius: 4px;
  box-shadow: 0 8px 24px color-mix(in srgb, #000 24%, transparent);
}

.sticky-menu button,
.sticky-menu label {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--editorColor);
  font-size: 12px;
  text-align: left;
}

.sticky-menu button:hover,
.sticky-menu label:hover {
  background: var(--editorColor10, color-mix(in srgb, var(--editorColor) 10%, transparent));
}

.sticky-menu-sub {
  display: flex;
  flex-direction: column;
  margin-left: 12px;
}

.sticky-menu-sub p {
  margin: 0;
  padding: 4px 6px;
  font-size: 12px;
}
</style>
