<template>
  <div class="editor-container">
    <side-bar v-if="init && !stickyProbe" />
    <div
      class="editor-middle"
      :class="{ 'sticky-window': stickyProbe, 'sticky-locked': stickyProbe && locked }"
    >
      <div
        v-if="stickyProbe"
        class="sticky-toolbar deskmark-ui"
      >
        <p
          v-if="waylandLimit"
          class="sticky-limit"
        >
          {{ t('sticky.wayland') }}
        </p>
        <label>
          <input
            v-model="pinned"
            type="checkbox"
            @change="setPinned"
          >
          {{ t('sticky.pin') }}
        </label>
        <label>
          <input
            v-model="edgeHide"
            type="checkbox"
            @change="setEdgeHide"
          >
          {{ t('sticky.edgeHide') }}
        </label>
        <button
          v-for="color of stickyColors"
          :key="color"
          type="button"
          class="sticky-color"
          :class="{ chosen: color === stickyColor }"
          :style="{ background: color }"
          @click="setStickyColor(color)"
        />
        <sticky-palette
          :color="stickyColor"
          :opacity="stickyOpacity"
          :locked="opacityLocked"
          @pick="setStickyColor"
          @fade="setStickyOpacity"
        />
        <label class="sticky-font">
          {{ t('sticky.font') }}
          <select
            :value="stickyFont"
            @change="setStickyFont(Number(($event.target as HTMLSelectElement).value))"
          >
            <option
              v-for="size of stickyFontSizes"
              :key="size"
              :value="size"
            >
              {{ size }}
            </option>
          </select>
        </label>
        <sticky-menu
          :pinned="pinned"
          :edge-hide="edgeHide"
          :locked="locked"
          :pass="passThrough"
          :bottom="bottom"
          :others="otherNotes"
          @pin="setPinnedFromMenu"
          @edge="setEdgeFromMenu"
          @lock="setLockedFromMenu"
          @pass="setPassFromMenu"
          @bottom="setBottomFromMenu"
          @settings="openStickySettings"
          @close="closeSticky"
          @main="openStickyInMain"
          @show="showOtherSticky"
          @others="loadOtherStickies"
        />
      </div>
      <title-bar
        :project="projectTree"
        :pathname="pathname"
        :filename="filename"
        :active="windowActive"
        :word-count="wordCount"
        :selection-word-count="selectionWordCount"
        :platform="platform"
        :is-saved="isSaved"
      />

      <div
        v-if="!init"
        class="editor-placeholder"
      />
      <recent v-if="!hasCurrentFile && init && !calendarOpen" />
      <calendar-view v-if="calendarOpen && !stickyProbe" />
      <editor-with-tabs
        v-if="hasCurrentFile && init && !calendarOpen"
        :markdown="markdown"
        :cursor="cursor"
        :muya-index-cursor="muyaIndexCursor"
        :source-code="sourceCode"
        :show-tab-bar="showTabBar"
        :text-direction="textDirection"
        :platform="platform"
      />
      <command-palette />
      <about-dialog />
      <export-setting-dialog />
      <rename />
      <import-modal />
    </div>
    <task-properties v-if="deskmarkTasks !== false && !stickyProbe && rightColumn !== 'tasks'" />
  </div>
</template>

<script setup lang="ts">
import { computed, watch, nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import { useMainStore } from '@/store'
import { storeToRefs } from 'pinia'
import { addStyles, addThemeStyle, addCustomStyle, type AddStylesOptions } from '@/util/theme'
import Recent from '@/components/recent/index.vue'
import EditorWithTabs from '@/components/editorWithTabs/index.vue'
import TitleBar from '@/components/titleBar/index.vue'
import SideBar from '@/components/sideBar/index.vue'
import AboutDialog from '@/components/about/index.vue'
import CommandPalette from '@/components/commandPalette/index.vue'
import ExportSettingDialog from '@/components/exportSettings/index.vue'
import Rename from '@/components/rename/index.vue'
import ImportModal from '@/components/import/index.vue'
import TaskProperties from '@/components/taskProperties.vue'
import CalendarView from '@/components/calendarView.vue'
import StickyPalette from '@/components/stickyPalette.vue'
import StickyMenu from '@/components/stickyMenu.vue'
import { useDeskmarkStore } from '@/store/deskmark'
import { useI18n } from 'vue-i18n'
import { normalizeColor, normalizeStickyFont, normalizeStickyOpacity, STICKY_COLORS, STICKY_FONT_SIZES } from 'common/stickyModel'
import bus from '@/bus'
import { DEFAULT_STYLE } from '@/config'
import { useLayoutStore } from '@/store/layout'
import { useListenForMainStore } from '@/store/listenForMain'
import { usePreferencesStore } from '@/store/preferences'
import { useEditorStore } from '@/store/editor'
import { useCommandCenterStore } from '@/store/commandCenter'
import { createTodoNote } from '@/util/createTodoNote'
import { exportCalendar } from '@/util/exportIcs'
import { useProjectStore } from '@/store/project'
import { useAutoUpdatesStore } from '@/store/autoUpdates'
import { useNotificationStore } from '@/store/notification'
import { showDeskmarkTarget } from '@/util/deskmarkView'

const mainStore = useMainStore()
const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()
const layoutStore = useLayoutStore()
const projectStore = useProjectStore()
const deskmarkStore = useDeskmarkStore()
const { calendarOpen } = storeToRefs(deskmarkStore)
const listenForMainStore = useListenForMainStore()
const autoUpdateStore = useAutoUpdatesStore()
const commandCenterStore = useCommandCenterStore()
const notificationStore = useNotificationStore()

const timer = ref<ReturnType<typeof setTimeout> | null>(null)
const stickyProbe = new URLSearchParams(window.location.search).get('sticky') === '1'
const waylandLimit = new URLSearchParams(window.location.search).get('stickyLimit') === 'wayland'
const stickyNote = new URLSearchParams(window.location.search).get('note') || ''
const stickyColors = STICKY_COLORS
const stickyFontSizes = STICKY_FONT_SIZES
const stickyQuery = new URLSearchParams(window.location.search)
const stickyColor = ref(normalizeColor(stickyQuery.get('color') || STICKY_COLORS[0]))
const stickyFont = ref(normalizeStickyFont(stickyQuery.get('font')))
const stickyOpacity = ref(normalizeStickyOpacity(stickyQuery.get('opacity')))
const opacityLocked = ref(false)
const pinned = ref(true)
const edgeHide = ref(stickyQuery.get('edgeHide') !== '0')
const locked = ref(stickyQuery.get('locked') === '1')
const passThrough = ref(stickyQuery.get('pass') === '1')
const bottom = ref(stickyQuery.get('bottom') === '1')
const otherNotes = ref<{ path: string, name: string }[]>([])
const { t } = useI18n()
let mouseIgnored = passThrough.value

const setPinned = (): void => {
  if (!stickyNote) return
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-pin', stickyNote, pinned.value).catch((error) => {
    console.error(error)
  })
}

const setPinnedFromMenu = (value: boolean): void => {
  pinned.value = value
  if (value) bottom.value = false
  setPinned()
}

const setEdgeFromMenu = (value: boolean): void => {
  edgeHide.value = value
  setEdgeHide()
}

const setEdgeHide = (): void => {
  if (!stickyNote) return
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-edge-hide', stickyNote, edgeHide.value).catch((error) => {
    console.error(error)
  })
}

const setLockedFromMenu = (value: boolean): void => {
  locked.value = value
  if (!stickyNote) return
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-lock', stickyNote, value).catch((error) => {
    console.error(error)
  })
}

const setPassFromMenu = (value: boolean): void => {
  passThrough.value = value
  mouseIgnored = value
  if (!stickyNote) return
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-pass', stickyNote, value).catch((error) => {
    console.error(error)
  })
}

const setBottomFromMenu = (value: boolean): void => {
  bottom.value = value
  if (value) pinned.value = false
  if (!stickyNote) return
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-bottom', stickyNote, value).catch((error) => {
    console.error(error)
  })
}

const openStickySettings = (): void => {
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-settings').catch((error) => {
    console.error(error)
  })
}

const closeSticky = (): void => {
  window.electron.windowControl.close()
}

const openStickyInMain = (): void => {
  if (!stickyNote) return
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-main', stickyNote).catch((error) => {
    console.error(error)
  })
}

const loadOtherStickies = (): void => {
  if (!stickyNote) return
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-list', stickyNote).then((notes) => {
    otherNotes.value = notes
  }).catch((error) => {
    console.error(error)
  })
}

const showOtherSticky = (path: string): void => {
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-show', path).catch((error) => {
    console.error(error)
  })
}

const onStickyMouse = (event: MouseEvent): void => {
  if (!passThrough.value || !stickyNote) return
  const target = event.target
  const chrome = target instanceof Element && !!target.closest('.sticky-toolbar, .title-bar, .sticky-menu, .sticky-palette, .sticky-menu-host')
  const ignore = !chrome
  if (ignore === mouseIgnored) return
  mouseIgnored = ignore
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-pass-hit', stickyNote, ignore).catch((error) => {
    console.error(error)
  })
}

if (stickyProbe) {
  window.addEventListener('mousemove', onStickyMouse)
  onBeforeUnmount(() => {
    window.removeEventListener('mousemove', onStickyMouse)
  })
}

const setStickyColor = (color: string): void => {
  const next = normalizeColor(color)
  stickyColor.value = next
  if (!stickyNote) return
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-color', stickyNote, next).catch((error) => {
    console.error(error)
  })
}

const setStickyFont = (size: number): void => {
  stickyFont.value = size
  preferencesStore.fontSize = size
  if (!stickyNote) return
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-font', stickyNote, size).catch((error) => {
    console.error(error)
  })
}

const setStickyOpacity = (opacity: number): void => {
  stickyOpacity.value = opacity
  if (!stickyNote) return
  window.electron.ipcRenderer.invoke('mt::deskmark::sticky-opacity', stickyNote, opacity).then((ok) => {
    opacityLocked.value = ok === false
  }).catch(() => {
    opacityLocked.value = true
  })
}

if (stickyProbe) {
  preferencesStore.fontSize = stickyFont.value
  watch(() => preferencesStore.fontSize, (size) => {
    if (size !== stickyFont.value) preferencesStore.fontSize = stickyFont.value
  })
}

const { windowActive, platform, init } = storeToRefs(mainStore)
const { showTabBar, rightColumn } = storeToRefs(layoutStore)
const { sourceCode, theme, customCss, textDirection, zoom, deskmarkTasks } = storeToRefs(preferencesStore)
const { projectTree } = storeToRefs(projectStore)
const { currentFile, selectionWordCount } = storeToRefs(editorStore)

const pathname = computed(() => currentFile.value?.pathname)
const filename = computed(() => currentFile.value?.filename)
const isSaved = computed(() => currentFile.value?.isSaved)
// `markdown` is read by `<editor-with-tabs>` whose prop is `required: true`.
// In template space we render that subtree only when `hasCurrentFile` is set,
// but vue-tsc can't see through the v-if guard — coalesce to '' so the prop
// type is `string`. The `<editor-with-tabs>` mount is still gated.
const markdown = computed<string>(() => currentFile.value?.markdown ?? '')
const cursor = computed(() => currentFile.value?.cursor)
const wordCount = computed(() => currentFile.value?.wordCount)
// `muyaIndexCursor` is loosely typed as `unknown` on the editor store; the
// downstream prop expects `Object | undefined`. Cast at the boundary.
const muyaIndexCursor = computed<Record<string, unknown> | undefined>(
  () => currentFile.value?.muyaIndexCursor as Record<string, unknown> | undefined
)

const hasCurrentFile = computed<boolean>(() => {
  return currentFile.value?.markdown !== undefined
})

// Watchers
watch(theme, (value, oldValue) => {
  if (value !== oldValue) {
    addThemeStyle(value)
  }
})

watch(customCss, (value, oldValue) => {
  if (value !== oldValue) {
    addCustomStyle({
      customCss: value
    })
  }
})

watch(zoom, (zoomValue) => {
  bus.emit('mt::window-zoom', zoomValue)
})

const setupDragDropHandler = (): void => {
  window.addEventListener(
    'dragover',
    (e: DragEvent) => {
      if (!e.dataTransfer || !e.dataTransfer.types.length) return

      if (e.dataTransfer.types.indexOf('Files') >= 0) {
        if (
          e.dataTransfer.items.length === 1 &&
          e.dataTransfer.items[0]!.type.indexOf('image') > -1
        ) {
          // Do nothing
        } else {
          e.preventDefault()
          if (timer.value) {
            clearTimeout(timer.value)
          }
          timer.value = setTimeout(() => {
            bus.emit('importDialog', false)
          }, 300)
          bus.emit('importDialog', true)
        }
        e.dataTransfer.dropEffect = 'copy'
      } else if (e.dataTransfer.types.indexOf('text/uri-list') >= 0) {
        // A web-link / web-image drag (e.g. an <img> dragged from a browser).
        // The muya editor's own dragover/drop handlers accept these and insert
        // an image block, so leave the drop enabled — forcing dropEffect='none'
        // here would clobber the editor's 'copy' and suppress the drop event.
      } else {
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'none'
      }
    },
    false
  )
}
onMounted(async () => {
  if (window.marktext?.initialState) {
    preferencesStore.SET_USER_PREFERENCE(window.marktext.initialState)
  }
  if (stickyProbe) preferencesStore.fontSize = stickyFont.value
  if (stickyProbe && stickyNote) {
    const ok = await window.electron.ipcRenderer.invoke('mt::deskmark::sticky-opacity', stickyNote, stickyOpacity.value).catch(() => false)
    opacityLocked.value = ok === false
  }

  mainStore.LISTEN_WIN_STATUS()
  await commandCenterStore.LISTEN_COMMAND_CENTER_BUS()
  layoutStore.LISTEN_FOR_LAYOUT()
  listenForMainStore.LISTEN_FOR_EDIT()
  preferencesStore.LISTEN_FOR_VIEW()
  listenForMainStore.LISTEN_FOR_SHOW_DIALOG()
  listenForMainStore.LISTEN_FOR_PANDOC_EXPORT()
  listenForMainStore.LISTEN_FOR_PARAGRAPH_INLINE_STYLE()
  projectStore.LISTEN_FOR_UPDATE_PROJECT()
  projectStore.LISTEN_FOR_LOAD_PROJECT()
  projectStore.LISTEN_FOR_SIDEBAR_CONTEXT_MENU()
  autoUpdateStore.LISTEN_FOR_UPDATE()
  preferencesStore.ASK_FOR_USER_PREFERENCE()
  preferencesStore.LISTEN_TOGGLE_VIEW()
  editorStore.LISTEN_SCREEN_SHOT()
  editorStore.LISTEN_FOR_CLOSE()
  editorStore.LISTEN_FOR_SAVE_AS()
  editorStore.LISTEN_FOR_MOVE_TO()
  editorStore.LISTEN_FOR_SAVE()
  editorStore.LISTEN_FOR_SET_PATHNAME()
  editorStore.LISTEN_FOR_BOOTSTRAP_WINDOW()
  editorStore.LISTEN_FOR_SAVE_CLOSE()
  editorStore.LISTEN_FOR_RENAME()
  editorStore.LISTEN_FOR_SET_LINE_ENDING()
  editorStore.LISTEN_FOR_SET_ENCODING()
  editorStore.LISTEN_FOR_SET_FINAL_NEWLINE()
  editorStore.LISTEN_FOR_NEW_TAB()
  editorStore.LISTEN_FOR_CLOSE_TAB()
  editorStore.LISTEN_FOR_TAB_CYCLE()
  editorStore.LISTEN_FOR_SWITCH_TABS()
  editorStore.LISTEN_FOR_PRINT_SERVICE_CLEARUP()
  editorStore.LISTEN_FOR_EXPORT_SUCCESS()
  editorStore.LISTEN_FOR_FILE_CHANGE()
  editorStore.LISTEN_WINDOW_ZOOM()
  editorStore.LISTEN_FOR_RELOAD_IMAGES()
  editorStore.LISTEN_FOR_CONTEXT_MENU()
  editorStore.LISTEN_FOR_STATE_REPLACE()
  const stopDeskmarkShow = window.electron.ipcRenderer.on('mt::deskmark-show', (_event, target) => {
    showDeskmarkTarget(target)
  })
  const stopNewTodo = window.electron.ipcRenderer.on('mt::deskmark-new-todo', () => {
    createTodoNote().catch(() => {})
  })
  const stopExportIcs = window.electron.ipcRenderer.on('mt::deskmark-export-ics', () => {
    exportCalendar().catch(() => {})
  })
  onBeforeUnmount(() => {
    stopDeskmarkShow()
    stopNewTodo()
    stopExportIcs()
  })

  // module: notification
  notificationStore.listenForNotification()

  setupDragDropHandler()

  nextTick(() => {
    // `initialState` from bootstrap carries nullable URL params (string|null);
    // `addStyles` requires non-null `theme` / `codeFontFamily` strings.
    // Coalesce against DEFAULT_STYLE for every nullable field.
    const init = window.marktext?.initialState
    const style: AddStylesOptions = {
      theme: init?.theme ?? DEFAULT_STYLE.theme,
      codeFontFamily: init?.codeFontFamily ?? DEFAULT_STYLE.codeFontFamily,
      codeFontSize: init?.codeFontSize ?? DEFAULT_STYLE.codeFontSize,
      hideScrollbar: init?.hideScrollbar ?? DEFAULT_STYLE.hideScrollbar
    }
    addStyles(style)
  })
})
</script>

<style scoped>
.editor-placeholder,
.editor-container {
  display: flex;
  flex-direction: row;
  position: absolute;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
.editor-container .hide {
  z-index: -1;
  opacity: 0;
  position: absolute;
  left: -10000px;
}
.editor-placeholder {
  background: var(--editorBgColor);
}
.editor-middle {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 100vh;
  position: relative;
  &.sticky-window {
    /* The title bar is fixed over the top of a frameless note. */
    box-sizing: border-box;
    height: 100%;
    min-height: 0;
    padding-top: var(--titleBarHeight);
  }
  &.sticky-locked :deep(.title-bar) {
    -webkit-app-region: no-drag;
  }
  & > .editor {
    flex: 1;
  }
}
.sticky-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
}
.sticky-limit {
  flex: 1 0 100%;
  margin: 0;
  font-size: 12px;
}
.sticky-color {
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--floatBorderColor, color-mix(in srgb, var(--editorColor) 25%, transparent));
  border-radius: 2px;
}
.sticky-color.chosen {
  outline: 2px solid var(--themeColor);
  outline-offset: 1px;
}
.sticky-font {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}
.sticky-font select,
.sticky-font input {
  color: inherit;
  background: transparent;
}
</style>
