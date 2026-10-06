import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WindowRect } from 'common/windowRect'

const FILE_NAME = 'probe-b-bounds.json'

export function readProbeBounds(userDataPath: string): WindowRect | null {
  try {
    const parsed = JSON.parse(readFileSync(join(userDataPath, FILE_NAME), 'utf8')) as Partial<WindowRect>
    if (
      typeof parsed.x !== 'number' ||
      typeof parsed.y !== 'number' ||
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number'
    ) {
      return null
    }
    return { x: parsed.x, y: parsed.y, width: parsed.width, height: parsed.height }
  } catch {
    return null
  }
}

export function writeProbeBounds(userDataPath: string, rect: WindowRect): void {
  mkdirSync(userDataPath, { recursive: true })
  const file = join(userDataPath, FILE_NAME)
  const temporary = `${file}.tmp`
  writeFileSync(temporary, JSON.stringify(rect))
  renameSync(temporary, file)
}
