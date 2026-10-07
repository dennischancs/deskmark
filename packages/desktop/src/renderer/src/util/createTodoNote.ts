import { useProjectStore } from '@/store/project'
import { t } from '../i18n'

export async function createTodoNote(): Promise<void> {
  const root = useProjectStore().projectTree?.pathname
  if (!root) return
  const created = await window.electron.ipcRenderer.invoke(
    'mt::deskmark::new-todo-note',
    root,
    t('menu.view.newTodoNote')
  )
  if (!created?.path) return
  window.electron.ipcRenderer.send('mt::open-file', created.path, {})
}
