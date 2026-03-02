import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as chokidar from 'chokidar';
import * as https from 'https';
import { fileURLToPath } from 'url';

let mainWindow: BrowserWindow | null = null;
let logWatchers: Map<string, chokidar.FSWatcher> = new Map();

const RELEASES_LATEST_API_URL = 'https://api.github.com/repos/DrScince/LogStudio/releases/latest';
const RELEASES_PAGE_URL = 'https://github.com/DrScince/LogStudio/releases';

const normalizeVersion = (version: string): string => version.replace(/^v/i, '').split('-')[0];

const isVersionNewer = (latest: string, current: string): boolean => {
  const latestParts = normalizeVersion(latest).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const currentParts = normalizeVersion(current).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(latestParts.length, currentParts.length);

  for (let index = 0; index < maxLength; index++) {
    const latestValue = latestParts[index] ?? 0;
    const currentValue = currentParts[index] ?? 0;
    if (latestValue > currentValue) return true;
    if (latestValue < currentValue) return false;
  }

  return false;
};

const fetchLatestRelease = (): Promise<{ tagName: string; htmlUrl: string }> => {
  return new Promise((resolve, reject) => {
    const request = https.get(
      RELEASES_LATEST_API_URL,
      {
        headers: {
          'User-Agent': 'LogStudio',
          Accept: 'application/vnd.github+json',
        },
      },
      (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GitHub API responded with status ${response.statusCode}`));
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const tagName = typeof parsed.tag_name === 'string' ? parsed.tag_name : '';
            const htmlUrl = typeof parsed.html_url === 'string' ? parsed.html_url : RELEASES_PAGE_URL;

            if (!tagName) {
              reject(new Error('No tag_name returned by GitHub API'));
              return;
            }

            resolve({ tagName, htmlUrl });
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on('error', (error) => reject(error));
    request.end();
  });
};

function createWindow() {
  // Icon-Pfad - versuche verschiedene Pfade
  const possibleIconPaths = [
    path.join(__dirname, '..', '..', 'LogStudio_Logo.ico'),
    path.join(__dirname, '..', '..', 'public', 'LogStudio_Logo.ico'),
    path.join(app.getAppPath(), 'LogStudio_Logo.ico'),
    path.join(app.getAppPath(), 'public', 'LogStudio_Logo.ico'),
  ];
  
  let iconPath = possibleIconPaths[0];
  
  // Finde das erste existierende Icon
  for (const possiblePath of possibleIconPaths) {
    if (fs.existsSync(possiblePath)) {
      iconPath = possiblePath;
      console.log('Icon found at:', iconPath);
      break;
    }
  }
  
  console.log('Using icon path:', iconPath);
  console.log('Icon exists:', fs.existsSync(iconPath));
    
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0d1117',
    frame: false,
    icon: iconPath,
    title: 'LogStudio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  }

  // Keyboard shortcut to toggle DevTools (F12 or Ctrl+Shift+I) - always available in dev mode
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (process.env.NODE_ENV === 'development') {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
        if (mainWindow && mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else if (mainWindow) {
          mainWindow.webContents.openDevTools();
        }
        event.preventDefault();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('read-log-file', async (event, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('watch-log-file', (event, filePath: string) => {
  if (logWatchers.has(filePath)) {
    console.log('Already watching:', filePath);
    return { success: true, alreadyWatching: true };
  }

  try {
    console.log('Starting to watch:', filePath);
    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      },
      usePolling: true,
      interval: 100
    });

    watcher.on('change', (path) => {
      console.log('File changed detected:', path);
      if (mainWindow) {
        mainWindow.webContents.send('log-file-changed', filePath);
      }
    });

    watcher.on('error', (error) => {
      console.error('Watcher error:', error);
    });

    logWatchers.set(filePath, watcher);
    return { success: true };
  } catch (error) {
    console.error('Failed to watch file:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('unwatch-log-file', (event, filePath: string) => {
  const watcher = logWatchers.get(filePath);
  if (watcher) {
    watcher.close();
    logWatchers.delete(filePath);
    return { success: true };
  }
  return { success: false, error: 'Watcher not found' };
});

ipcMain.handle('list-log-files', async (event, directory: string) => {
  try {
    const files = await fs.promises.readdir(directory);
    const logFiles = files
      .filter((file) => file.endsWith('.log'))
      .map((file) => ({
        name: file,
        path: path.join(directory, file),
      }));
    return { success: true, files: logFiles };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('get-file-stats', async (event, filePath: string) => {
  try {
    const stats = await fs.promises.stat(filePath);
    return {
      success: true,
      stats: {
        size: stats.size,
        mtime: stats.mtime.toISOString(),
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('read-log-chunk', async (event, filePath: string, startByte: number, endByte: number) => {
  try {
    const fd = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(endByte - startByte);
    await fd.read(buffer, 0, endByte - startByte, startByte);
    await fd.close();
    return { success: true, content: buffer.toString('utf-8') };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('get-app-path', () => {
  return { success: true, path: app.getAppPath() };
});

ipcMain.handle('get-default-log-directory', () => {
  const logDir = path.join(app.getAppPath(), '..', 'Log');
  return { success: true, path: logDir };
});

ipcMain.handle('show-open-dialog', async () => {
  if (!mainWindow) {
    return { success: false, error: 'Main window not available' };
  }

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Log-Datei öffnen',
      filters: [
        { name: 'Log-Dateien', extensions: ['log', 'txt'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, filePath: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('show-open-directory-dialog', async () => {
  if (!mainWindow) {
    return { success: false, error: 'Main window not available' };
  }

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Log-Ordner auswählen',
      properties: ['openDirectory'],
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, directoryPath: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Fenstersteuerung
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('open-external', async (_event, url: string) => {
  const { shell } = await import('electron');
  await shell.openExternal(url);
});

ipcMain.handle('read-changelog', async () => {
  try {
    // Versuche verschiedene Pfade für CHANGELOG.md
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'CHANGELOG.md'),
      path.join(app.getAppPath(), 'CHANGELOG.md'),
      path.join(app.getAppPath(), '..', 'CHANGELOG.md'),
    ];
    
    for (const changelogPath of possiblePaths) {
      if (fs.existsSync(changelogPath)) {
        const content = await fs.promises.readFile(changelogPath, 'utf-8');
        return { success: true, content };
      }
    }
    
    return { success: false, error: 'CHANGELOG.md not found' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const currentVersion = app.getVersion();
    const latestRelease = await fetchLatestRelease();
    const updateAvailable = isVersionNewer(latestRelease.tagName, currentVersion);

    return {
      success: true,
      updateAvailable,
      currentVersion,
      latestVersion: normalizeVersion(latestRelease.tagName),
      releaseUrl: latestRelease.htmlUrl || RELEASES_PAGE_URL,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
      updateAvailable: false,
      releaseUrl: RELEASES_PAGE_URL,
    };
  }
});
