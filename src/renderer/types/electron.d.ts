export interface ElectronAPI {
  readLogFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeXmlFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  writeJsonFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  writeMarkdownFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  watchLogFile: (filePath: string) => Promise<{ success: boolean; alreadyWatching?: boolean; error?: string }>;
  unwatchLogFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  listLogFiles: (directory: string, includeSubdirectories?: boolean) => Promise<{ success: boolean; files?: Array<{ name: string; path: string }>; error?: string }>;
  listLogFilesStream?: (directory: string, includeSubdirectories: boolean | undefined, requestId: string) => Promise<{ success: boolean; error?: string }>;
  watchDirectory: (directory: string) => Promise<{ success: boolean; alreadyWatching?: boolean; error?: string }>;
  unwatchDirectory: (directory: string) => Promise<{ success: boolean; error?: string }>;
  onDirectoryChanged: (callback: (directory: string) => void) => void;
  removeDirectoryChangedListener: () => void;
  onListLogFilesProgress?: (callback: (payload: { requestId: string; files: Array<{ name: string; path: string }>; done: boolean; error?: string }) => void) => void;
  removeListLogFilesProgressListener?: () => void;
  getFileStats: (filePath: string) => Promise<{ success: boolean; stats?: { size: number; mtime: string }; error?: string }>;
  readLogChunk: (filePath: string, startByte: number, endByte: number) => Promise<{ success: boolean; content?: string; error?: string }>;
  onLogFileChanged: (callback: (filePath: string) => void) => (() => void) | void;
  removeLogFileChangedListener: () => void;
  getAppPath: () => Promise<{ success: boolean; path?: string; error?: string }>;
  getAppVersion: () => Promise<{ success: boolean; version?: string }>;
  getDefaultLogDirectory: () => Promise<{ success: boolean; path?: string; error?: string }>;
  showOpenDialog: () => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  showOpenFilesDialog: () => Promise<{ success: boolean; filePaths?: string[]; canceled?: boolean; error?: string }>;
  showOpenDirectoryDialog: () => Promise<{ success: boolean; directoryPath?: string; canceled?: boolean; error?: string }>;
  exportHtmlToPdf: (
    html: string,
    defaultFileName?: string
  ) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
  writeClipboard: (payload: {
    text?: string;
    rtf?: string;
    html?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onExportPdfProgress: (
    callback: (info: { percent: number; stage: string }) => void
  ) => () => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  openFileInEditor: (filePath: string, lineNumber: number, editorOrder?: string[]) => Promise<{ success: boolean }>;
  readChangelog: () => Promise<{ success: boolean; content?: string; error?: string }>;
  checkForUpdates: () => Promise<{ success: boolean; error?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  installUpdate: () => void;
  onUpdateAvailable: (callback: (info: { version: string; portable: boolean; releaseUrl?: string }) => void) => void;
  onDownloadProgress: (callback: (info: { percent: number }) => void) => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => void;
  onUpdateError: (callback: (info: { message: string }) => void) => void;
  onUpdateNotAvailable: (callback: () => void) => void;
  removeUpdateListeners: () => void;
  onFilesDropped: (callback: (paths: string[]) => void) => void;
  removeFilesDroppedListener: () => void;
  onOpenFileFromCli: (callback: (filePath: string) => void) => void;
  removeOpenFileFromCliListener: () => void;
  ollamaStatus: (baseUrl?: string) => Promise<{
    installed: boolean;
    running: boolean;
    baseUrl: string;
    version?: string;
    models: string[];
    error?: string;
  }>;
  ollamaInstall: () => Promise<{ success: boolean; message: string }>;
  ollamaOpenDownload: () => Promise<{ success: boolean }>;
  ollamaEnsureRunning: (baseUrl?: string) => Promise<{ success: boolean }>;
  ollamaPullModel: (
    model?: string,
    baseUrl?: string
  ) => Promise<{ success: boolean; error?: string }>;
  onOllamaPullProgress: (
    callback: (info: { model: string; status: string; percent?: number }) => void
  ) => () => void;
  ollamaChat: (payload: {
    model?: string;
    baseUrl?: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    requestId?: string;
    fileContext?: { fileName: string; excerpt: string; note?: string };
  }) => Promise<{ success: boolean; content?: string; error?: string; requestId?: string }>;
  onOllamaChatToken: (
    callback: (info: { requestId: string; token: string }) => void
  ) => () => void;
  aiComponentPreference: () => Promise<{
    preference: { aiEnabled: boolean; source?: string; pendingChoice?: boolean } | null;
    needsChoice: boolean;
  }>;
  aiComponentSet: (aiEnabled: boolean) => Promise<{
    success: boolean;
    install?: { success: boolean; message: string };
  }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
