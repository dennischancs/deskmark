export { IndexLock } from './lock.ts'
export { collectVaultFiles, groupTasks } from './vault.ts'
export { editTaskFile } from './editTask.ts'
export {
  SCHEMA_VERSION,
  VaultIndex,
  applyExternalChange,
  type NoteRow,
  type RebuildReport,
  type TaskRow,
  type VaultFile
} from './database.ts'
