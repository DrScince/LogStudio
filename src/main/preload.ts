import { contextBridge, ipcRenderer } from 'electron';

// Dateipfade aus dem Drop-Event werden hier im Preload extrahiert,
// weil file.path nur im Preload-Kontext verfügbar ist.
let _dropCallback: ((paths: string[]) => void) | null = null;

// Buffer CLI/file-association opens until React registers its listener.
// Without this, did-finish-load can send open-file-from-cli before mount
// and the first double-click is lost (second click via second-instance works).
let _cliFileCallback: ((filePath: string) => void) | null = null;
let _pendingCliFile: string | null = null;

ipcRenderer.on('open-file-from-cli', (_event, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath) return;
  if (_cliFileCallback) {
    _cliFileCallback(filePath);
  } else {
    _pendingCliFile = filePath;
  }
});

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
  writeXmlFile: (filePath: string, content: string) => ipcRenderer.invoke('write-xml-file', filePath, content),
  writeJsonFile: (filePath: string, content: string) => ipcRenderer.invoke('write-xml-file', filePath, content),
  writeMarkdownFile: (filePath: string, content: string) => ipcRenderer.invoke('write-xml-file', filePath, content),
  watchLogFile: (filePath: string) => ipcRenderer.invoke('watch-log-file', filePath),
  unwatchLogFile: (filePath: string) => ipcRenderer.invoke('unwatch-log-file', filePath),
  listLogFiles: (directory: string, includeSubdirectories?: boolean) => ipcRenderer.invoke('list-log-files', directory, includeSubdirectories),
  listLogFilesStream: (directory: string, includeSubdirectories: boolean | undefined, requestId: string) =>
    ipcRenderer.invoke('list-log-files-stream', directory, includeSubdirectories, requestId),
  watchDirectory: (directory: string) => ipcRenderer.invoke('watch-directory', directory),
  unwatchDirectory: (directory: string) => ipcRenderer.invoke('unwatch-directory', directory),
  onDirectoryChanged: (callback: (directory: string) => void) => {
    ipcRenderer.on('directory-changed', (_event, dir) => callback(dir));
  },
  removeDirectoryChangedListener: () => {
    ipcRenderer.removeAllListeners('directory-changed');
  },
  onListLogFilesProgress: (callback: (payload: { requestId: string; files: Array<{ name: string; path: string }>; done: boolean; error?: string }) => void) => {
    ipcRenderer.on('list-log-files-progress', (_event, payload) => callback(payload));
  },
  removeListLogFilesProgressListener: () => {
    ipcRenderer.removeAllListeners('list-log-files-progress');
  },
  getFileStats: (filePath: string) => ipcRenderer.invoke('get-file-stats', filePath),
  readLogChunk: (filePath: string, startByte: number, endByte: number) =>
    ipcRenderer.invoke('read-log-chunk', filePath, startByte, endByte),
  onLogFileChanged: (callback: (filePath: string) => void) => {
    const listener = (_event: any, filePath: string) => callback(filePath);
    ipcRenderer.on('log-file-changed', listener);
    return () => ipcRenderer.removeListener('log-file-changed', listener);
  },
  removeLogFileChangedListener: () => {
    ipcRenderer.removeAllListeners('log-file-changed');
  },
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getDefaultLogDirectory: () => ipcRenderer.invoke('get-default-log-directory'),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showOpenFilesDialog: () => ipcRenderer.invoke('show-open-files-dialog'),
  showOpenDirectoryDialog: () => ipcRenderer.invoke('show-open-directory-dialog'),
  exportHtmlToPdf: (html: string, defaultFileName?: string) =>
    ipcRenderer.invoke('export-html-to-pdf', html, defaultFileName),
  writeClipboard: (payload: { text?: string; rtf?: string; html?: string }) =>
    ipcRenderer.invoke('write-clipboard', payload),
  onExportPdfProgress: (callback: (info: { percent: number; stage: string }) => void) => {
    const listener = (_event: unknown, info: { percent: number; stage: string }) => callback(info);
    ipcRenderer.on('export-pdf-progress', listener);
    return () => ipcRenderer.removeListener('export-pdf-progress', listener);
  },
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('show-item-in-folder', filePath),
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
  consumePendingOpenFile: () =>
    ipcRenderer.invoke('consume-pending-open-file') as Promise<string | null>,
  onOpenFileFromCli: (callback: (filePath: string) => void) => {
    _cliFileCallback = callback;
    if (_pendingCliFile) {
      const pending = _pendingCliFile;
      _pendingCliFile = null;
      callback(pending);
    }
  },
  removeOpenFileFromCliListener: () => {
    _cliFileCallback = null;
  },
});
