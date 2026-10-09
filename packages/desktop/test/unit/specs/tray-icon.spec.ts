import path from 'path'
import { describe, expect, it } from 'vitest'
import { resolveTrayIcon, trayIconPoints } from '../../../src/main/deskmark/stickies'

describe('tray icon path', () => {
  it('uses the packaged resources icon before the working directory', () => {
    const packaged = path.join('C:/Program Files/Deskmark/resources', 'static', 'logo-small.png')
    const dev = path.join('D:/deskmark', 'static', 'logo-small.png')
    const found = resolveTrayIcon('C:/Program Files/Deskmark/resources', 'D:/deskmark', (file) => file === packaged || file === dev)
    expect(found).toBe(packaged)
  })

  it('falls back to the working directory during development', () => {
    const dev = path.join('D:/deskmark', 'static', 'logo-small.png')
    const found = resolveTrayIcon('C:/electron/resources', 'D:/deskmark', (file) => file === dev)
    expect(found).toBe(dev)
  })
})

describe('tray icon size', () => {
  it('fits the macOS menu bar instead of the 1024px master', () => {
    expect(trayIconPoints('darwin')).toBe(22)
    expect(trayIconPoints('win32')).toBe(16)
    expect(trayIconPoints('linux')).toBe(24)
  })
})
