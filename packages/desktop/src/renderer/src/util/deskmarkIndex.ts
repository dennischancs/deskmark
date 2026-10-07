export interface IndexTick {
  seen: number
  scanning: boolean
  changed: boolean
}

// Rebuilding the calendar from every indexed note is much heavier than
// moving the "files seen" counter. While a scan is still running, do that
// rebuild about once a second, and only when a note actually changed.
const RELOAD_WAIT_MS = 1200

export function watchDeskmarkIndex(
  reload: () => void,
  onTick?: (tick: IndexTick) => void
): () => void {
  let waiting: ReturnType<typeof setTimeout> | null = null
  const stop = window.electron.ipcRenderer.on('mt::deskmark-index-tick', (_event, tick) => {
    onTick?.(tick)
    if (!tick.scanning) {
      if (waiting) clearTimeout(waiting)
      waiting = null
      reload()
      return
    }
    if (!tick.changed || waiting) return
    waiting = setTimeout(() => {
      waiting = null
      reload()
    }, RELOAD_WAIT_MS)
  })
  return () => {
    if (waiting) clearTimeout(waiting)
    stop()
  }
}
