export { IndexLock } from './lock.ts'
export { collectVaultFiles, groupTasks, listTextFiles, matchesExtension } from './vault.ts'
export { prepareVaultFile, type PreparedNote, type PreparedTask } from './prepare.ts'
export { indexTextFiles, MAX_TEXT_BYTES, type IndexEvent, type IndexRequest } from './scan.ts'
export { normalizeExtensions } from '../../deskmark-core/src/extensions.ts'
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
