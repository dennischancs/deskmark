import { type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/view'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

interface DeskmarkPreferenceSource {
  getItem(key: string): unknown
}

const deskmarkOn = (preferences: DeskmarkPreferenceSource | undefined, key: string): boolean => {
  if (!preferences) return true
  return preferences.getItem(key) !== false
}

export default function(
  keybindings: Keybindings,
  preferences?: DeskmarkPreferenceSource
): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [
    {
      label: t('menu.view.commandPalette'),
      accelerator: keybindings.getAccelerator('view.command-palette') ?? undefined,
      click(_menuItem, focusedWindow) {
        actions.showCommandPalette(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      type: 'separator'
    },
    {
      id: 'sourceCodeModeMenuItem',
      label: t('menu.view.sourceCodeMode'),
      accelerator: keybindings.getAccelerator('view.source-code-mode') ?? undefined,
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleSourceCodeMode(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      id: 'typewriterModeMenuItem',
      label: t('menu.view.typewriterMode'),
      accelerator: keybindings.getAccelerator('view.typewriter-mode') ?? undefined,
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleTypewriterMode(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      id: 'focusModeMenuItem',
      label: t('menu.view.focusMode'),
      accelerator: keybindings.getAccelerator('view.focus-mode') ?? undefined,
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleFocusMode(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      type: 'separator'
    },
    {
      label: t('menu.view.toggleSidebar'),
      id: 'sideBarMenuItem',
      accelerator: keybindings.getAccelerator('view.toggle-sidebar') ?? undefined,
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleSidebar(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.view.toggleTabbar'),
      id: 'tabBarMenuItem',
      accelerator: keybindings.getAccelerator('view.toggle-tabbar') ?? undefined,
      type: 'checkbox',
      checked: false,
      click(_item, focusedWindow) {
        actions.toggleTabBar(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.view.toggleTableOfContents'),
      id: 'tocMenuItem',
      accelerator: keybindings.getAccelerator('view.toggle-toc') ?? undefined,
      click(_, focusedWindow) {
        actions.showTableOfContents(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      label: t('menu.view.reloadImages'),
      accelerator: keybindings.getAccelerator('view.reload-images') ?? undefined,
      click(_item, focusedWindow) {
        actions.reloadImageCache(focusedWindow as BrowserWindow | undefined)
      }
    },
    {
      type: 'separator'
    },
    {
      label: t('menu.view.deskmark'),
      submenu: [
        {
          label: t('menu.view.openCalendar'),
          click(_item, focusedWindow) {
            actions.showDeskmark(focusedWindow as BrowserWindow | undefined, 'calendar')
          }
        },
        {
          label: t('menu.view.openTasks'),
          click(_item, focusedWindow) {
            actions.showDeskmark(focusedWindow as BrowserWindow | undefined, 'tasks')
          }
        },
        {
          label: t('menu.view.newTodoNote'),
          click(_item, focusedWindow) {
            actions.newTodoNote(focusedWindow as BrowserWindow | undefined)
          }
        },
        {
          label: t('menu.view.exportCalendar'),
          click(_item, focusedWindow) {
            actions.exportCalendar(focusedWindow as BrowserWindow | undefined)
          }
        },
        {
          label: t('menu.view.openWordCount'),
          click(_item, focusedWindow) {
            actions.showDeskmark(focusedWindow as BrowserWindow | undefined, 'wordcount')
          }
        },
        {
          label: t('menu.view.stick'),
          click(_item, focusedWindow) {
            actions.showDeskmark(focusedWindow as BrowserWindow | undefined, 'sticky')
          }
        },
        {
          type: 'separator'
        },
        {
          id: 'deskmarkCalendarMenuItem',
          label: t('menu.view.calendar'),
          type: 'checkbox',
          checked: deskmarkOn(preferences, 'deskmarkCalendar'),
          click(item) {
            actions.setDeskmarkEnabled('deskmarkCalendar', !!item.checked)
          }
        },
        {
          id: 'deskmarkTasksMenuItem',
          label: t('menu.view.tasks'),
          type: 'checkbox',
          checked: deskmarkOn(preferences, 'deskmarkTasks'),
          click(item) {
            actions.setDeskmarkEnabled('deskmarkTasks', !!item.checked)
          }
        },
        {
          id: 'deskmarkRemindersMenuItem',
          label: t('menu.view.reminders'),
          type: 'checkbox',
          checked: deskmarkOn(preferences, 'deskmarkReminders'),
          click(item) {
            actions.setDeskmarkEnabled('deskmarkReminders', !!item.checked)
          }
        },
        {
          id: 'deskmarkWordCountMenuItem',
          label: t('menu.view.wordCount'),
          type: 'checkbox',
          checked: deskmarkOn(preferences, 'deskmarkWordCount'),
          click(item) {
            actions.setDeskmarkEnabled('deskmarkWordCount', !!item.checked)
          }
        },
        {
          type: 'separator'
        },
        {
          label: t('menu.view.deskmarkSettings'),
          click() {
            actions.openDeskmarkSettings()
          }
        }
      ]
    }
  ]

  const viewMenu: MenuItemConstructorOptions = {
    label: t('menu.view.view'),
    submenu
  }

  if (global.MARKTEXT_DEBUG) {
    submenu.push({
      type: 'separator'
    })
    submenu.push({
      label: t('menu.view.showDeveloperTools'),
      accelerator: keybindings.getAccelerator('view.toggle-dev-tools') ?? undefined,
      click(_item, win) {
        actions.debugToggleDevTools(win as BrowserWindow | undefined)
      }
    })
    submenu.push({
      label: t('menu.view.reloadWindow'),
      accelerator: keybindings.getAccelerator('view.dev-reload') ?? undefined,
      click(_item, focusedWindow) {
        actions.debugReloadWindow(focusedWindow as BrowserWindow | undefined)
      }
    })
  }

  return viewMenu
}
