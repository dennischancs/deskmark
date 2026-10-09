import {
  SEPARATOR,
  getNewFile,
  getNewDirectory,
  getCOPY,
  getCUT,
  getPASTE,
  getRENAME,
  getDELETE,
  getShowInFolder,
  getStickOnDesktop
} from './menuItems'
import { popupContextMenu, type ContextMenuItem } from '../popupMenu'

export const showContextMenu = (
  event: { clientX: number; clientY: number },
  hasPathCache: boolean,
  markdown = false
): void => {
  const contextItems: ContextMenuItem[] = [
    getNewFile(),
    getNewDirectory(),
    SEPARATOR,
    getCOPY(),
    getCUT(),
    getPASTE(),
    SEPARATOR,
    getRENAME(),
    getDELETE(),
    SEPARATOR,
    getShowInFolder()
  ]
  if (markdown) contextItems.push(getStickOnDesktop())

  // PASTE entry (index 5) toggles based on the cached source path.
  contextItems[5].enabled = hasPathCache

  const items: ContextMenuItem[] = contextItems.map((item) => {
    if (!item || item.type === 'separator') return item
    const click = item.click
    return {
      ...item,
      click: click ? () => click(null, null) : undefined
    }
  })

  popupContextMenu(items, { x: event.clientX, y: event.clientY })
}
