import bus from '@/bus'
import { useEditorStore } from '@/store/editor'
import type { DeskmarkEditResult, DeskmarkTaskGroups, DeskmarkTaskPatch } from '@shared/types/ipc'

export async function editDeskmarkTask(
  root: string,
  notePath: string,
  line: number,
  patch: DeskmarkTaskPatch
): Promise<DeskmarkTaskGroups | null> {
  const editorStore = useEditorStore()
  const fullPath = window.path.join(root, notePath)
  const tab = editorStore.tabs.find(item => window.fileUtils.isSamePathSync(item.pathname, fullPath))
  const result: DeskmarkEditResult | null = await window.electron.ipcRenderer.invoke('mt::deskmark::edit-task', {
    root,
    notePath,
    line,
    patch,
    content: tab && !tab.isSaved ? tab.markdown : null,
    write: !tab || tab.isSaved
  })
  if (!result?.changed) return result?.groups ?? null
  if (tab) {
    tab.markdown = result.markdown
    if (editorStore.currentFile?.id === tab.id) {
      bus.emit('file-changed', {
        id: tab.id,
        markdown: result.markdown,
        cursor: tab.cursor,
        history: tab.history,
        isReload: true
      })
    }
  }
  return result.groups
}
