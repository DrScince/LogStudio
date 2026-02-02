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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
