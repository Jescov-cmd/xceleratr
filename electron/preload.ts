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

  onLiveSpeed: (cb: (x: number) => void): (() => void) => {
    const handler = (_e: unknown, x: number) => cb(x)
    ipcRenderer.on('live-speed', handler as any)
    return () => ipcRenderer.removeListener('live-speed', handler as any)
  },

  getAccentColor: (): Promise<string | null> => ipcRenderer.invoke('accent-color-get'),
  onAccentColorChanged: (cb: (color: string | null) => void): (() => void) => {
    const handler = (_e: unknown, color: string | null) => cb(color)
    ipcRenderer.on('accent-color-changed', handler as any)
    return () => ipcRenderer.removeListener('accent-color-changed', handler as any)
  },

  openSupportEmail: () => ipcRenderer.invoke('support-email-open'),

  setHotkeyEnabled: (enabled: boolean) => ipcRenderer.invoke('hotkey-set-enabled', enabled),
  getHotkeyStatus:  () => ipcRenderer.invoke('hotkey-get-status'),
  hotkeyBind:       (action: string, accelerator: string) =>
                      ipcRenderer.invoke('hotkey-bind', action, accelerator),

  refreshTray: () => ipcRenderer.invoke('tray-refresh'),

  onSettingsChanged: (cb: (settings: Record<string, unknown>) => void): (() => void) => {
    const handler = (_e: unknown, s: Record<string, unknown>) => cb(s)
    ipcRenderer.on('settings-changed', handler as any)
    return () => ipcRenderer.removeListener('settings-changed', handler as any)
  },

  getUpdateStatus: () => ipcRenderer.invoke('update-get-status'),
  installUpdateNow: () => ipcRenderer.invoke('update-install-now'),
  onUpdateStatus: (cb: (status: Record<string, unknown>) => void): (() => void) => {
    const handler = (_e: unknown, s: Record<string, unknown>) => cb(s)
    ipcRenderer.on('update-status', handler as any)
    return () => ipcRenderer.removeListener('update-status', handler as any)
  },
})
