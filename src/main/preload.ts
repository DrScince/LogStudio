import { contextBridge, ipcRenderer } from 'electron';

// Dateipfade aus dem Drop-Event werden hier im Preload extrahiert,
// weil file.path nur im Preload-Kontext verfügbar ist.
let _dropCallback: ((paths: string[]) => void) | null = null;

window.addEventListener('dragover', (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
}, false);

window.addEventListener('drop', (e: DragEvent) => {
  e.preventDefault();
  if (_dropCallback) {
    const files = Array.from(e.dataTransfer?.files ?? []);
    const paths = files.map((f) => (f as any).path as string).filter(Boolean);
    if (paths.length > 0) _dropCallback(paths);
  }
}, false);

contextBridge.exposeInMainWorld('electronAPI', {
  readLogFile: (filePath: string) => ipcRenderer.invoke('read-log-file', filePath),
  watchLogFile: (filePath: string) => ipcRenderer.invoke('watch-log-file', filePath),
  unwatchLogFile: (filePath: string) => ipcRenderer.invoke('unwatch-log-file', filePath),
  listLogFiles: (directory: string, includeSubdirectories?: boolean) => ipcRenderer.invoke('list-log-files', directory, includeSubdirectories),
  watchDirectory: (directory: string) => ipcRenderer.invoke('watch-directory', directory),
  unwatchDirectory: (directory: string) => ipcRenderer.invoke('unwatch-directory', directory),
  onDirectoryChanged: (callback: (directory: string) => void) => {
    ipcRenderer.on('directory-changed', (_event, dir) => callback(dir));
  },
  removeDirectoryChangedListener: () => {
    ipcRenderer.removeAllListeners('directory-changed');
  },
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
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getDefaultLogDirectory: () => ipcRenderer.invoke('get-default-log-directory'),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showOpenDirectoryDialog: () => ipcRenderer.invoke('show-open-directory-dialog'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  openFileInEditor: (filePath: string, lineNumber: number, editorOrder?: string[]) => ipcRenderer.invoke('open-file-in-editor', filePath, lineNumber, editorOrder),
  readChangelog: () => ipcRenderer.invoke('read-changelog'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onDownloadProgress: (callback: (info: { percent: number }) => void) => {
    ipcRenderer.on('update-download-progress', (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  },
  onUpdateError: (callback: (info: { message: string }) => void) => {
    ipcRenderer.on('update-error', (_event, info) => callback(info));
  },
  onUpdateNotAvailable: (callback: () => void) => {
    ipcRenderer.on('update-not-available', () => callback());
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-error');
    ipcRenderer.removeAllListeners('update-not-available');
  },
  onFilesDropped: (callback: (paths: string[]) => void) => {
    _dropCallback = callback;
  },
  removeFilesDroppedListener: () => {
    _dropCallback = null;
  },
  onOpenFileFromCli: (callback: (filePath: string) => void) => {
    ipcRenderer.on('open-file-from-cli', (_event, filePath) => callback(filePath));
  },
  removeOpenFileFromCliListener: () => {
    ipcRenderer.removeAllListeners('open-file-from-cli');
  },
});
