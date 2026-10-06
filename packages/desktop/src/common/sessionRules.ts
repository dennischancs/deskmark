export const SNAPSHOT_INTERVAL_MS = 7000

export function prefersSourceMode(name: string): boolean {
  return name.toLowerCase().endsWith('.txt')
}
