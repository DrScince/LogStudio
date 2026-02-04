import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readLogFile: (filePath: string) => ipcRenderer.invoke('read-log-file', filePath),
  watchLogFile: (filePath: string) => ipcRenderer.invoke('watch-log-file', filePath),
  unwatchLogFile: (filePath: string) => ipcRenderer.invoke('unwatch-log-file', filePath),
  listLogFiles: (directory: string) => ipcRenderer.invoke('list-log-files', directory),
  getFileStats: (filePath: string) => ipcRenderer.invoke('get-file-stats', filePath),
  readLogChunk: (filePath: string, startByte: number, endByte: number) =>
    ipcRenderer.invoke('read-log-chunk', filePath, startByte, endByte),
  onLogFileChanged: (callback: (filePath: string) => void) => {
    ipcRenderer.on('log-file-changed', (event, filePath) => callback(filePath));
  },
  removeLogFileChangedListener: () => {
    ipcRenderer.removeAllListeners('log-file-changed');
  },
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getDefaultLogDirectory: () => ipcRenderer.invoke('get-default-log-directory'),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  readChangelog: () => ipcRenderer.invoke('read-changelog'),
});
