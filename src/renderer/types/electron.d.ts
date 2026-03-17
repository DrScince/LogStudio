export interface ElectronAPI {
  readLogFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  watchLogFile: (filePath: string) => Promise<{ success: boolean; alreadyWatching?: boolean; error?: string }>;
  unwatchLogFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  listLogFiles: (directory: string) => Promise<{ success: boolean; files?: Array<{ name: string; path: string }>; error?: string }>;
  getFileStats: (filePath: string) => Promise<{ success: boolean; stats?: { size: number; mtime: string }; error?: string }>;
  readLogChunk: (filePath: string, startByte: number, endByte: number) => Promise<{ success: boolean; content?: string; error?: string }>;
  onLogFileChanged: (callback: (filePath: string) => void) => void;
  removeLogFileChangedListener: () => void;
  getAppPath: () => Promise<{ success: boolean; path?: string; error?: string }>;
  getDefaultLogDirectory: () => Promise<{ success: boolean; path?: string; error?: string }>;
  showOpenDialog: () => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  showOpenDirectoryDialog: () => Promise<{ success: boolean; directoryPath?: string; canceled?: boolean; error?: string }>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  openExternal: (url: string) => Promise<void>;
  readChangelog: () => Promise<{ success: boolean; content?: string; error?: string }>;
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  onUpdateAvailable: (callback: (info: { version: string; portable: boolean; releaseUrl?: string }) => void) => void;
  onDownloadProgress: (callback: (info: { percent: number }) => void) => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => void;
  onUpdateError: (callback: (info: { message: string }) => void) => void;
  removeUpdateListeners: () => void;
  onFilesDropped: (callback: (paths: string[]) => void) => void;
  removeFilesDroppedListener: () => void;
  onOpenFileFromCli: (callback: (filePath: string) => void) => void;
  removeOpenFileFromCliListener: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
