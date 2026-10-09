<template>
  <button
    ref="triggerRef"
    type="button"
    class="sticky-palette-trigger"
    data-testid="sticky-palette-trigger"
    :aria-expanded="open"
    aria-haspopup="dialog"
    @click="toggle"
  >
    <span
      class="sticky-palette-chip"
      :style="{ '--chip': color }"
    />
    {{ t('sticky.palette') }}
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      class="sticky-palette-host"
    >
      <div
        class="sticky-palette-scrim"
        @pointerdown="close"
      />
      <div
        ref="panelRef"
        class="sticky-palette deskmark-ui"
        data-testid="sticky-palette"
        role="dialog"
        tabindex="-1"
        :aria-label="t('sticky.palette')"
        :style="panelStyle"
      >
        <div
          ref="fieldRef"
          class="sv"
          data-testid="sticky-palette-field"
          :style="{ backgroundColor: hueColor }"
          @pointerdown="onFieldDown"
          @pointermove="onFieldMove"
          @pointerup="onFieldUp"
        >
          <span class="sv-white" />
          <span class="sv-black" />
          <span
            class="sv-thumb"
            :style="{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }"
          />
        </div>
        <input
          class="hue"
          type="range"
          min="0"
          max="360"
          :value="Math.round(hsv.h)"
          :aria-label="t('sticky.palette')"
          @input="onHue"
          @change="commitColor"
        >
        <label class="opacity-row">
          {{ t('sticky.opacity') }}
          <input
            data-testid="sticky-palette-opacity"
            type="range"
            min="10"
            max="100"
            step="1"
            :value="shownOpacity"
            :disabled="locked"
            :style="{ '--track': opacityTrack }"
            @input="onOpacityInput"
            @change="commitOpacity"
          >
          <span>{{ shownOpacity }}%</span>
        </label>
        <p
          v-if="locked"
          class="limit"
        >
          {{ t('sticky.opacityLimit') }}
        </p>
        <input
          data-testid="sticky-palette-hex"
          type="text"
          spellcheck="false"
          :value="hexText"
          :aria-label="t('sticky.customColor')"
          @input="hexText = ($event.target as HTMLInputElement).value"
          @change="commitHex"
          @keydown.enter.prevent="commitHex"
        >
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { hexToHsv, hsvToHex, normalizeColor, normalizeStickyOpacity } from 'common/stickyModel'
import { placeStickyPalette } from 'common/stickyPalette'

const props = defineProps<{
  color: string
  opacity: number
  locked: boolean
}>()

const emit = defineEmits<{
  pick: [color: string]
  fade: [opacity: number]
}>()

const { t } = useI18n()
const open = ref(false)
const dragging = ref(false)
const hsv = ref(hexToHsv(props.color))
const hexText = ref(normalizeColor(props.color))
const shownOpacity = ref(props.opacity)
const place = ref({ left: 8, top: 8 })
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const fieldRef = ref<HTMLElement | null>(null)

const liveColor = computed(() => hsvToHex(hsv.value.h, hsv.value.s, hsv.value.v))
const hueColor = computed(() => hsvToHex(hsv.value.h, 1, 1))
const opacityTrack = computed(() => `linear-gradient(90deg, transparent, ${liveColor.value})`)
const panelStyle = computed(() => ({
  top: `${place.value.top}px`,
  left: `${place.value.left}px`
}))

const syncFromColor = (color: string): void => {
  const next = hexToHsv(color)
  // Gray has no hue. Keep the slider where the user left it.
  if (next.s === 0) next.h = hsv.value.h
  hsv.value = next
  hexText.value = normalizeColor(color)
}

watch(() => props.color, (color) => {
  if (!dragging.value) syncFromColor(color)
})

watch(() => props.opacity, (opacity) => {
  shownOpacity.value = opacity
})

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

const onResize = (): void => {
  if (open.value) layout()
}

const onKey = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') close()
}

const toggle = (): void => {
  open.value = !open.value
}

const close = (): void => {
  commitHex()
  open.value = false
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

window.addEventListener('resize', onResize)
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKey)
})

const commitColor = (): void => {
  const next = liveColor.value
  if (next !== normalizeColor(props.color)) emit('pick', next)
}

const moveField = (event: PointerEvent): void => {
  const field = fieldRef.value
  if (!field) return
  const rect = field.getBoundingClientRect()
  const s = rect.width <= 0 ? 0 : Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const v = rect.height <= 0 ? 0 : Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / rect.height))
  hsv.value = { h: hsv.value.h, s, v }
  hexText.value = liveColor.value
}

const onFieldDown = (event: PointerEvent): void => {
  const field = event.currentTarget as HTMLElement
  field.setPointerCapture(event.pointerId)
  dragging.value = true
  moveField(event)
}

const onFieldMove = (event: PointerEvent): void => {
  if (!dragging.value) return
  moveField(event)
}

const onFieldUp = (event: PointerEvent): void => {
  if (!dragging.value) return
  moveField(event)
  dragging.value = false
  commitColor()
}

const onHue = (event: Event): void => {
  hsv.value = { ...hsv.value, h: Number((event.target as HTMLInputElement).value) }
  hexText.value = liveColor.value
}

const onOpacityInput = (event: Event): void => {
  shownOpacity.value = normalizeStickyOpacity((event.target as HTMLInputElement).value)
}

const commitOpacity = (): void => {
  if (shownOpacity.value !== props.opacity) emit('fade', shownOpacity.value)
}

const commitHex = (): void => {
  const raw = hexText.value.trim()
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) {
    hexText.value = normalizeColor(props.color)
    return
  }
  const next = normalizeColor(raw)
  syncFromColor(next)
  if (next !== normalizeColor(props.color)) emit('pick', next)
}
</script>

<style scoped>
.sticky-palette-trigger {
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

.sticky-palette-trigger[aria-expanded='true'] {
  outline: 2px solid var(--themeColor);
  outline-offset: 1px;
}

.sticky-palette-chip {
  width: 16px;
  height: 16px;
  background-color: var(--chip) !important;
  border: 1px solid var(--floatBorderColor, color-mix(in srgb, var(--editorColor) 25%, transparent));
  border-radius: 2px;
}

.sticky-palette-scrim {
  position: fixed;
  inset: 0;
  z-index: 10000;
}

.sticky-palette {
  position: fixed;
  z-index: 10001;
  width: 196px;
  max-height: calc(100vh - 16px);
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--floatBorderColor, color-mix(in srgb, var(--editorColor) 25%, transparent));
  border-radius: 4px;
  box-shadow: 0 8px 24px color-mix(in srgb, #000 24%, transparent);
}

.sv {
  position: relative;
  height: 96px;
  border-radius: 4px;
  touch-action: none;
}

.sv-white,
.sv-black {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}

.sv-white {
  background: linear-gradient(to right, #fff, transparent);
}

.sv-black {
  background: linear-gradient(to top, #000, transparent);
}

.sv-thumb {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px #000;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.sticky-palette input[type='range'] {
  appearance: none;
  width: 100%;
  height: 14px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  accent-color: var(--themeColor);
}

.sticky-palette input[type='range']::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 4px;
  background: var(--track, linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000));
}

.sticky-palette input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -3px;
  border: 2px solid var(--editorColor);
  border-radius: 50%;
  background: var(--editorBgColor);
}

.hue {
  --track: linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);
}

.opacity-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.opacity-row input {
  flex: 1;
}

.limit {
  margin: 0;
  font-size: 12px;
}

.sticky-palette input[type='text'] {
  width: 100%;
  box-sizing: border-box;
  color: var(--editorColor);
}
</style>
