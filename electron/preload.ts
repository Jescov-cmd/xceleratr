import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close:    () => ipcRenderer.send('window-close'),
  platform: process.platform,

  getSettings:  () => ipcRenderer.invoke('settings-get'),
  saveSettings: (s: Record<string, unknown>) => ipcRenderer.invoke('settings-save', s),

  applyMouse: (s: Record<string, unknown>) => ipcRenderer.invoke('mouse-apply', s),

  getStartup: () => ipcRenderer.invoke('startup-get'),
  setStartup: (enable: boolean) => ipcRenderer.invoke('startup-set', enable),

  profilesList:   () => ipcRenderer.invoke('profiles-list'),
  profilesSave:   (p: unknown) => ipcRenderer.invoke('profiles-save', p),
  profilesDelete: (id: string) => ipcRenderer.invoke('profiles-delete', id),
})
