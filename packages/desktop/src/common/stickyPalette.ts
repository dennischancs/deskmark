export interface PaletteRect {
  left: number
  top: number
  width: number
  height: number
}

// Sticky windows are short. Open under the trigger, then above it when the
// panel would leave the window. Shift sideways so it stays on screen.
export function placeStickyPalette(
  trigger: PaletteRect,
  panel: { width: number, height: number },
  viewport: { width: number, height: number },
  margin = 8
): { left: number, top: number } {
  const gap = 4
  let left = trigger.left
  let top = trigger.top + trigger.height + gap
  const maxLeft = Math.max(margin, viewport.width - margin - panel.width)
  if (left > maxLeft) left = maxLeft
  if (left < margin) left = margin
  if (top + panel.height > viewport.height - margin) {
    const above = trigger.top - gap - panel.height
    top = above >= margin ? above : margin
  }
  const maxTop = Math.max(margin, viewport.height - margin - panel.height)
  if (top > maxTop) top = maxTop
  return { left: Math.round(left), top: Math.round(top) }
}
