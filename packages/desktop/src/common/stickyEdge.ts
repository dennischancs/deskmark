export type StickyEdge = 'left' | 'right' | 'top' | 'bottom'

export interface Frame {
  x: number
  y: number
  width: number
  height: number
}

/** How close a note must be, in pixels, before it sticks to a work-area edge. */
export const SNAP_DISTANCE = 28
/** Visible strip left on screen while the note is tucked away. */
export const EDGE_PEEK = 8

const EDGE_ORDER: StickyEdge[] = ['left', 'right', 'top', 'bottom']

export function framesEqual(a: Frame, b: Frame): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

export function frameContains(frame: Frame, x: number, y: number): boolean {
  return x >= frame.x && y >= frame.y && x < frame.x + frame.width && y < frame.y + frame.height
}

export function mostlyOnScreen(frame: Frame, work: Frame): boolean {
  const left = Math.max(frame.x, work.x)
  const top = Math.max(frame.y, work.y)
  const right = Math.min(frame.x + frame.width, work.x + work.width)
  const bottom = Math.min(frame.y + frame.height, work.y + work.height)
  const overlap = Math.max(0, right - left) * Math.max(0, bottom - top)
  return overlap >= frame.width * frame.height * 0.5
}

export function snapToWorkArea(
  frame: Frame,
  work: Frame,
  distance = SNAP_DISTANCE
): { frame: Frame, edges: StickyEdge[] } {
  let x = frame.x
  let y = frame.y
  const edges: StickyEdge[] = []
  const near = (gap: number): boolean => gap <= distance && gap >= -EDGE_PEEK
  const left = frame.x - work.x
  const right = work.x + work.width - (frame.x + frame.width)
  const top = frame.y - work.y
  const bottom = work.y + work.height - (frame.y + frame.height)
  if (near(left)) {
    x = work.x
    edges.push('left')
  } else if (near(right)) {
    x = work.x + work.width - frame.width
    edges.push('right')
  }
  if (near(top)) {
    y = work.y
    edges.push('top')
  } else if (near(bottom)) {
    y = work.y + work.height - frame.height
    edges.push('bottom')
  }
  return { frame: { x, y, width: frame.width, height: frame.height }, edges }
}

// A shared edge between two monitors is not a place to hide: the note would
// slide onto the other screen. Only an outer edge of the desktop can tuck.
export function outerEdges(work: Frame, displays: Frame[]): StickyEdge[] {
  const others = displays.filter(display => !framesEqual(display, work))
  const overlapY = (display: Frame): boolean =>
    display.y < work.y + work.height - 16 && display.y + display.height > work.y + 16
  const overlapX = (display: Frame): boolean =>
    display.x < work.x + work.width - 16 && display.x + display.width > work.x + 16
  const edges: StickyEdge[] = []
  if (!others.some(display => display.x + display.width <= work.x + 4 && overlapY(display))) edges.push('left')
  if (!others.some(display => display.x >= work.x + work.width - 4 && overlapY(display))) edges.push('right')
  if (!others.some(display => display.y + display.height <= work.y + 4 && overlapX(display))) edges.push('top')
  if (!others.some(display => display.y >= work.y + work.height - 4 && overlapX(display))) edges.push('bottom')
  return edges
}

export function concealEdge(
  snapped: StickyEdge[],
  outer: StickyEdge[],
  allowed: StickyEdge[] = EDGE_ORDER
): StickyEdge | null {
  return EDGE_ORDER.find(edge => snapped.includes(edge) && outer.includes(edge) && allowed.includes(edge)) ?? null
}

export function concealedFrame(frame: Frame, work: Frame, edge: StickyEdge, peek = EDGE_PEEK): Frame {
  if (edge === 'left') return { ...frame, x: work.x - frame.width + peek }
  if (edge === 'right') return { ...frame, x: work.x + work.width - peek }
  if (edge === 'top') return { ...frame, y: work.y - frame.height + peek }
  return { ...frame, y: work.y + work.height - peek }
}

export function peekFrame(frame: Frame, work: Frame, edge: StickyEdge, peek = EDGE_PEEK): Frame {
  if (edge === 'left') return { x: work.x - 4, y: frame.y, width: peek + 8, height: frame.height }
  if (edge === 'right') return { x: work.x + work.width - peek - 4, y: frame.y, width: peek + 8, height: frame.height }
  if (edge === 'top') return { x: frame.x, y: work.y - 4, width: frame.width, height: peek + 8 }
  return { x: frame.x, y: work.y + work.height - peek - 4, width: frame.width, height: peek + 8 }
}
