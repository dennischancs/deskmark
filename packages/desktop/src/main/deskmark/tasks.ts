import type { DeskmarkScanOptions, DeskmarkTaskGroups } from '@shared/types/ipc'
import { ensureScan } from './scanner'

export function readTaskGroups(
  root: string,
  now = new Date(),
  timeZone = 'Asia/Shanghai',
  options?: DeskmarkScanOptions | null
): DeskmarkTaskGroups {
  return ensureScan(root, options, now, timeZone)
}
