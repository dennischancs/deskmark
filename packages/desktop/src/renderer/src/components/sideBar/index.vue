<template>
  <div
    v-show="showSideBar"
    ref="sideBar"
    class="side-bar"
    :style="[!rightColumn ? { 'min-width': '45px' } : {}, { width: `${finalSideBarWidth}px` }]"
  >
    <div class="left-column">
      <ul>
        <li
          v-for="(c, index) of sideBarIcons"
          :key="index"
          :class="{ active: c.id === rightColumn }"
          :title="c.name()"
          :aria-label="c.name()"
          @click="handleLeftIconClick(c.id)"
        >
          <component :is="c.icon" />
        </li>
      </ul>
      <ul class="bottom">
        <li
          v-for="(c, index) of sideBarBottomIcons"
          :key="index"
          :title="c.name()"
          :aria-label="c.name()"
          @click="handleLeftBottomClick(c.id)"
        >
          <component :is="c.icon" />
        </li>
      </ul>
    </div>
    <div
      v-show="rightColumn"
      class="right-column"
    >
      <tree
        v-if="rightColumn === 'files'"
        :project-tree="projectTree"
        :opened-files="openedFiles"
        :tabs="tabs"
      />
      <side-bar-search v-else-if="rightColumn === 'search'" />
      <toc v-else-if="rightColumn === 'toc'" />
      <task-lists v-else-if="rightColumn === 'tasks'" />
      <plugin-panel
        v-else-if="pluginView"
        :title="t('plugin.words')"
      />
    </div>
    <div
      v-show="rightColumn"
      ref="dragBar"
      class="drag-bar"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useLayoutStore } from '@/store/layout'
import { useProjectStore } from '@/store/project'
import { useEditorStore } from '@/store/editor'
import { useDeskmarkStore } from '@/store/deskmark'
import { usePreferencesStore } from '@/store/preferences'
import { showDeskmarkTarget } from '@/util/deskmarkView'

import { sideBarIcons as builtinSideBarIcons, sideBarBottomIcons } from './help'
import { Histogram as WordsIcon } from '@element-plus/icons-vue'
import Tree from './tree.vue'
import SideBarSearch from './search.vue'
import Toc from './toc.vue'
import TaskLists from './tasks.vue'
import PluginPanel from '../pluginPanel/index.vue'
import { PluginHost, readManifest, type PluginManifest } from '../../../../../../deskmark-plugin/src/index.ts'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useCommandCenterStore } from '@/store/commandCenter'
import bus from '@/bus'
import type { TabDescriptor } from './types'

const layoutStore = useLayoutStore()
const { t } = useI18n()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const deskmarkStore = useDeskmarkStore()
const preferenceStore = usePreferencesStore()
const { deskmarkCalendar, deskmarkTasks, deskmarkWordCount } = storeToRefs(preferenceStore)

const sideBar = ref<HTMLDivElement | null>(null)
const dragBar = ref<HTMLDivElement | null>(null)

const openedFiles = ref<TabDescriptor[]>([])
const sideBarViewWidth = ref(280)

const { rightColumn, showSideBar, sideBarWidth } = storeToRefs(layoutStore)

const pluginHost = new PluginHost()
pluginHost.registerBuiltin({ id: 'tasks.open', title: t('sideBar.icons.tasks'), kind: 'command', builtin: true })
pluginHost.registerBuiltin({ id: 'calendar.open', title: t('calendar.title'), kind: 'view', builtin: true })
pluginHost.registerBuiltin({ id: 'sticky.open', title: t('sticky.open'), kind: 'command', builtin: true })
const sampleManifest: PluginManifest = {
  id: 'wordcount',
  name: 'Word count',
  api: 1,
  entry: 'index.html',
  permissions: ['notes.read', 'ui.command', 'ui.panel']
}
const pluginLoaded = ref(false)
try {
  const loaded = pluginHost.load(readManifest(sampleManifest), {
    commands: [{ id: 'count', title: t('plugin.words') }],
    views: [{ id: 'panel', title: t('plugin.words') }]
  })
  const commandCenter = useCommandCenterStore()
  for (const command of loaded.commands) {
    const id = sampleManifest.id + ':' + command.id
    const entry = {
      id,
      description: t('plugin.words'),
      execute: () => {
        showDeskmarkTarget('wordcount')
      }
    }
    if (!commandCenter.rootCommand.subcommands.some(command => command.id === id)) {
      commandCenter.REGISTER_COMMAND(entry)
    }
  }
  pluginLoaded.value = true
  bus.on('language-changed', () => {
    const command = commandCenter.rootCommand.subcommands.find(item => item.id === sampleManifest.id + ':count')
    if (command) command.description = t('plugin.words')
  })
} catch (error) {
  console.error(error)
}
const sideBarIcons = computed(() => [
  ...builtinSideBarIcons.filter((icon) => {
    if (icon.id === 'calendar') return deskmarkCalendar.value !== false
    if (icon.id === 'tasks') return deskmarkTasks.value !== false
    return true
  }),
  ...(deskmarkWordCount.value === false
    ? []
    : pluginHost.views().filter(view => !view.builtin).map(view => ({
      id: view.id,
      name: () => t('plugin.words'),
      icon: WordsIcon
    })))
])

watch(deskmarkCalendar, (enabled) => {
  if (enabled === false) deskmarkStore.calendarOpen = false
})
watch(deskmarkTasks, (enabled) => {
  if (enabled === false && rightColumn.value === 'tasks') {
    layoutStore.SET_LAYOUT({ rightColumn: 'files' })
  }
})
watch(deskmarkWordCount, (enabled) => {
  if (enabled === false && rightColumn.value.startsWith('wordcount:')) {
    layoutStore.SET_LAYOUT({ rightColumn: 'files' })
  }
})
if (deskmarkCalendar.value === false) deskmarkStore.calendarOpen = false
if (deskmarkTasks.value === false && rightColumn.value === 'tasks') {
  layoutStore.SET_LAYOUT({ rightColumn: 'files' })
}
if (deskmarkWordCount.value === false && rightColumn.value.startsWith('wordcount:')) {
  layoutStore.SET_LAYOUT({ rightColumn: 'files' })
}
const pluginView = computed(() => deskmarkWordCount.value !== false && pluginLoaded.value && rightColumn.value === 'wordcount:panel'
  ? { entry: sampleManifest.entry, manifest: sampleManifest }
  : null)

const { projectTree } = storeToRefs(projectStore)
const { tabs } = storeToRefs(editorStore)

const finalSideBarWidth = computed<number>(() => {
  if (!showSideBar.value) return 0
  if (rightColumn.value === '') return 45
  return sideBarViewWidth.value < 220 ? 220 : sideBarViewWidth.value
})

onMounted(() => {
  nextTick(() => {
    const dragBarEl = dragBar.value
    if (!dragBarEl) return
    let startX = 0
    let currentSideBarWidth = +sideBarWidth.value
    let startWidth = currentSideBarWidth

    sideBarViewWidth.value = currentSideBarWidth

    const mouseUpHandler = (): void => {
      document.removeEventListener('mousemove', mouseMoveHandler, false)
      document.removeEventListener('mouseup', mouseUpHandler, false)
      layoutStore.CHANGE_SIDE_BAR_WIDTH(currentSideBarWidth < 220 ? 220 : currentSideBarWidth)
    }

    const mouseMoveHandler = (event: MouseEvent): void => {
      const offset = event.clientX - startX
      currentSideBarWidth = startWidth + offset
      sideBarViewWidth.value = currentSideBarWidth
    }

    const mouseDownHandler = (event: MouseEvent): void => {
      startX = event.clientX
      startWidth = +sideBarWidth.value
      document.addEventListener('mousemove', mouseMoveHandler, false)
      document.addEventListener('mouseup', mouseUpHandler, false)
    }

    dragBarEl.addEventListener('mousedown', mouseDownHandler, false)
  })
})

const handleLeftIconClick = (name: string): void => {
  if (name === 'calendar') {
    deskmarkStore.calendarOpen = !deskmarkStore.calendarOpen
    return
  }
  deskmarkStore.calendarOpen = false
  if (rightColumn.value === name) {
    // Capture the expanded width BEFORE collapsing: once rightColumn is '',
    // finalSideBarWidth evaluates to the 45px icon strip and would overwrite
    // the user's real width with the clamped 220px minimum (#2421).
    const widthToPersist = finalSideBarWidth.value
    layoutStore.SET_LAYOUT({ rightColumn: '' })
    layoutStore.CHANGE_SIDE_BAR_WIDTH(widthToPersist)
  } else {
    const needDispatch = rightColumn.value === ''
    layoutStore.SET_LAYOUT({ rightColumn: name })
    sideBarViewWidth.value = +sideBarWidth.value
    if (needDispatch) {
      layoutStore.CHANGE_SIDE_BAR_WIDTH(finalSideBarWidth.value)
    }
  }
}

const handleLeftBottomClick = (name: string): void => {
  if (name === 'settings') {
    projectStore.OPEN_SETTING_WINDOW()
  }
}
</script>

<style scoped>
.side-bar {
  display: flex;
  flex-shrink: 0;
  flex-grow: 0;
  width: 280px;
  height: 100vh;
  min-width: 220px;
  position: relative;
  color: var(--sideBarColor);
  user-select: none;
  background: var(--sideBarBgColor);
  border-right: 1px solid var(--itemBgColor);
}

.side-bar .left-column svg {
  color: var(--iconColor);
}

.left-column {
  height: 100%;
  width: 45px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-top: 28px;
  box-sizing: border-box;
}

.left-column > ul {
  opacity: 1;
}

.left-column ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}

.left-column ul > li {
  width: 45px;
  height: 45px;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  cursor: pointer;
}

.left-column ul > li > svg {
  width: 18px;
  height: 18px;
  color: var(--sideBarIconColor);
  opacity: 1;
  transition: transform 0.25s ease-in-out;
}

.left-column ul > li.active > svg {
  color: var(--themeColor);
}

.side-bar:hover .left-column ul li svg {
  opacity: 1;
}

.right-column {
  flex: 1;
  width: calc(100% - 50px);
  height: 100%;
  box-sizing: border-box;
  padding-top: var(--titleBarHeight);
  overflow: auto;
  -webkit-app-region: no-drag;
}

.drag-bar {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  width: 3px;
  cursor: col-resize;
}

.drag-bar:hover {
  border-right: 2px solid var(--iconColor);
}
</style>
