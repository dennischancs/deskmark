import { useDeskmarkStore } from '@/store/deskmark'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import { usePreferencesStore } from '@/store/preferences'
import { useProjectStore } from '@/store/project'

type DeskmarkSwitch = 'deskmarkCalendar' | 'deskmarkTasks' | 'deskmarkWordCount'

const enable = (key: DeskmarkSwitch): void => {
  const preferences = usePreferencesStore()
  if (preferences[key] === false) {
    preferences.SET_SINGLE_PREFERENCE({ type: key, value: true })
  }
}

export const showDeskmarkTarget = (target: unknown): void => {
  const deskmark = useDeskmarkStore()
  const layout = useLayoutStore()
  const project = useProjectStore()
  const editor = useEditorStore()

  if (target === 'calendar') {
    enable('deskmarkCalendar')
    deskmark.calendarOpen = true
    return
  }
  if (target === 'tasks') {
    enable('deskmarkTasks')
    deskmark.calendarOpen = false
    layout.SET_LAYOUT({ rightColumn: 'tasks', showSideBar: true })
    return
  }
  if (target === 'wordcount') {
    enable('deskmarkWordCount')
    deskmark.calendarOpen = false
    layout.SET_LAYOUT({ rightColumn: 'wordcount:panel', showSideBar: true })
    return
  }
  if (target === 'sticky') {
    const root = project.projectTree?.pathname
    const note = editor.currentFile?.pathname
    if (!root || !note) return
    window.electron.ipcRenderer.invoke('mt::deskmark::sticky-open', root, note).catch((error) => {
      console.error(error)
    })
  }
}
