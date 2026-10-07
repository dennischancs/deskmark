export const SNAPSHOT_INTERVAL_MS = 7000

export function prefersSourceMode(name: string): boolean {
  return name.toLowerCase().endsWith('.txt')
}

export const SUGGEST_SOURCE_BYTES = 1_000_000
export const SOURCE_ONLY_BYTES = 10_000_000

export type LargeFileMode = 'normal' | 'suggest-source' | 'source-only'

export function largeFileMode(bytes: number): LargeFileMode {
  if (!Number.isFinite(bytes) || bytes < SUGGEST_SOURCE_BYTES) return 'normal'
  if (bytes < SOURCE_ONLY_BYTES) return 'suggest-source'
  return 'source-only'
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length
}
