export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayArea {
  x: number
  y: number
  width: number
  height: number
}

export function restoreWindowRect(
  saved: WindowRect | null,
  displays: DisplayArea[],
  fallback: WindowRect
): WindowRect {
  if (!saved || saved.width < 80 || saved.height < 80) return fallback
  const visible = displays.some(
    (display) =>
      saved.x < display.x + display.width &&
      saved.x + Math.min(saved.width, display.width) > display.x &&
      saved.y < display.y + display.height &&
      saved.y + Math.min(saved.height, display.height) > display.y
  )
  if (visible) return saved
  const primary = displays[0]
  if (!primary) return fallback
  return {
    x: primary.x,
    y: primary.y,
    width: Math.min(fallback.width, primary.width),
    height: Math.min(fallback.height, primary.height)
  }
}
