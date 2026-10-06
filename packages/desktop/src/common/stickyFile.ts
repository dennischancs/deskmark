import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { emptyUiState, readUiState, type UiStateFile } from './stickyModel'

export function uiStatePath(vaultRoot: string): string {
  return join(vaultRoot, '.deskmark', 'ui-state.json')
}

export function loadUiState(vaultRoot: string): UiStateFile {
  const file = uiStatePath(vaultRoot)
  if (!existsSync(file)) return emptyUiState()
  return readUiState(readFileSync(file, 'utf8'))
}

export function saveUiState(vaultRoot: string, state: UiStateFile): void {
  const file = uiStatePath(vaultRoot)
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.tmp`
  writeFileSync(temporary, JSON.stringify(state))
  renameSync(temporary, file)
}
