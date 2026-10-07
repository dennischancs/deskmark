import { usePreferencesStore } from '@/store/preferences'
import { useProjectStore } from '@/store/project'
import { tasksToIcs } from '../../../../../deskmark-core/src/ics.ts'
import type { DeskmarkTaskRef } from '@shared/types/ipc'
import { t } from '../i18n'

export async function exportCalendar(): Promise<void> {
  const root = useProjectStore().projectTree?.pathname
  if (!root) return
  const prefs = usePreferencesStore()
  const groups = await window.electron.ipcRenderer.invoke('mt::deskmark::tasks', root, {
    extensions: prefs.deskmarkScanExtensions,
    taskLine: prefs.deskmarkRuleTaskLine,
    commentMeta: prefs.deskmarkRuleComment,
    frontMatter: prefs.deskmarkRuleFrontMatter,
    dateInText: prefs.deskmarkRuleDateInText,
    extraPrefixes: prefs.deskmarkExtraPrefixes
  })
  if (!groups) return
  const tasks = [groups.overdue, groups.today, groups.upcoming, groups.inbox, groups.done]
    .flat()
    .filter((task): task is DeskmarkTaskRef => Boolean(task?.due))
    .map(task => ({
      path: task.notePath,
      line: task.line,
      id: task.taskKey,
      text: task.text,
      due: task.due,
      done: task.status === 'done'
    }))
  const ics = tasksToIcs(tasks, new Date())
  const chosen = await window.electron.dialog.showSave({
    title: t('menu.view.exportCalendar'),
    defaultPath: window.path.join(root, 'deskmark.ics'),
    filters: [{ name: 'iCalendar', extensions: ['ics'] }]
  })
  if (!chosen) return
  await window.fileUtils.writeFile(chosen, ics)
}
