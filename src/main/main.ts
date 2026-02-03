import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as chokidar from 'chokidar';
import { fileURLToPath } from 'url';

let mainWindow: BrowserWindow | null = null;
let logWatchers: Map<string, chokidar.FSWatcher> = new Map();

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
    return { success: true, alreadyWatching: true };
  }

  try {
    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: false,
    });

    watcher.on('change', () => {
      if (mainWindow) {
        mainWindow.webContents.send('log-file-changed', filePath);
      }
    });

    logWatchers.set(filePath, watcher);
    return { success: true };
  } catch (error) {
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
