let draggedKey = ''

export function beginTaskDrag(
  taskKey: string,
  line: number | null,
  status: string,
  event: DragEvent
): void {
  if (status === 'done' || line == null) {
    event.preventDefault()
    return
  }
  draggedKey = taskKey
  event.dataTransfer?.setData('text/plain', taskKey)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

export function readTaskDrag(event: DragEvent): string {
  return event.dataTransfer?.getData('text/plain') || draggedKey
}

export function endTaskDrag(): void {
  draggedKey = ''
}
