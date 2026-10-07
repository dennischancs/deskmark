export type DiskChangeChoice = 'keep' | 'reload' | 'save-as'

// The banner used to treat any truthy value as reload. Save-as is a string,
// so it must not take that path.
export function diskChangeChoice(status: unknown): DiskChangeChoice {
  if (status === true || status === 'reload') return 'reload'
  if (status === 'save-as') return 'save-as'
  return 'keep'
}
