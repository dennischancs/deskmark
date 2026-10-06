import { join } from 'node:path'
import { collectVaultFiles, groupTasks, VaultIndex, type TaskRow } from '../../../../deskmark-index/src/index.ts'

export interface TaskGroups {
  inbox: TaskRow[]
  today: TaskRow[]
  upcoming: TaskRow[]
  overdue: TaskRow[]
  done: TaskRow[]
}

export function readTaskGroups(root: string, now = new Date(), timeZone = 'Asia/Shanghai'): TaskGroups {
  const index = new VaultIndex(join(root, '.deskmark'))
  index.open()
  try {
    index.rebuild(collectVaultFiles(root))
    return groupTasks(index.tasks(), now, timeZone)
  } finally {
    index.close()
  }
}
