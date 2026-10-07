export const DEFAULT_REMINDER_SECONDS = 30
export const MIN_REMINDER_SECONDS = 1
export const MAX_REMINDER_SECONDS = 600

export function normalizeReminderSeconds(value: unknown): number {
  const seconds = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(seconds)) return DEFAULT_REMINDER_SECONDS
  return Math.min(MAX_REMINDER_SECONDS, Math.max(MIN_REMINDER_SECONDS, Math.round(seconds)))
}
