import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('deskmark', {
  call: (method: string, extra?: { path?: string }) => ipcRenderer.invoke('mt::deskmark::plugin-call', {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    method,
    path: extra?.path
  }),
  onNote: (listener: () => void) => {
    ipcRenderer.on('mt::deskmark::plugin-refresh', () => listener())
  }
})
