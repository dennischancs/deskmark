import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { applyTaskEdit, type EditResult, type InlinePatch } from '../../deskmark-core/src/index.ts'

export function editTaskFile(
  absolutePath: string,
  line: number,
  patch: InlinePatch,
  now: Date,
  timeZone: string,
  source: string | null,
  write: boolean
): EditResult {
  const original = source ?? readFileSync(absolutePath, 'utf8')
  const result = applyTaskEdit(original, line, patch, now, timeZone)
  if (result.changed && write) {
    const temporary = `${absolutePath}.deskmark-tmp`
    writeFileSync(temporary, result.markdown)
    renameSync(temporary, absolutePath)
  }
  return result
}
