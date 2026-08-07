import { app, BrowserWindow, ipcMain, dialog, net, clipboard } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import * as chokidar from 'chokidar';
import { fileURLToPath, pathToFileURL } from 'url';

let mainWindow: BrowserWindow | null = null;
let logWatchers: Map<string, chokidar.FSWatcher> = new Map();
let dirWatchers: Map<string, chokidar.FSWatcher> = new Map();

type DiscoveredFile = { name: string; path: string; mtimeMs: number };

const isTextFile = async (filePath: string): Promise<boolean> => {
  try {
    const buffer = Buffer.alloc(512);
    const fd = await fs.promises.open(filePath, 'r');
    const { bytesRead } = await fd.read(buffer, 0, 512, 0);
    await fd.close();
    if (bytesRead === 0) return true;
    return !buffer.subarray(0, bytesRead).includes(0);
  } catch {
    return false;
  }
};

const scanDirCandidates = async (dir: string, includeSubdirectories: boolean): Promise<DiscoveredFile[]> => {
  const items = await fs.promises.readdir(dir, { withFileTypes: true });
  const results: DiscoveredFile[] = [];

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isFile()) {
      try {
        const stats = await fs.promises.stat(fullPath);
        results.push({ name: item.name, path: fullPath, mtimeMs: stats.mtimeMs });
      } catch {
        // Ignore inaccessible files
      }
    } else if (includeSubdirectories && item.isDirectory()) {
      try {
        const nested = await scanDirCandidates(fullPath, includeSubdirectories);
        results.push(...nested);
      } catch {
        // Skip inaccessible subdirectories
      }
    }
  }

  return results;
};

const sortCandidatesNewestFirst = (files: DiscoveredFile[]): DiscoveredFile[] => {
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files;
};

const filterTextFilesInBatches = async (
  files: DiscoveredFile[],
  batchSize: number,
  onBatch?: (files: Array<{ name: string; path: string }>) => void
): Promise<Array<{ name: string; path: string }>> => {
  const accepted: Array<{ name: string; path: string }> = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const checks = await Promise.all(
      batch.map(async (file) => ({ file, isText: await isTextFile(file.path) }))
    );

    const acceptedBatch = checks
      .filter((item) => item.isText)
      .map((item) => ({ name: item.file.name, path: item.file.path }));

    if (acceptedBatch.length > 0) {
      accepted.push(...acceptedBatch);
      if (onBatch) onBatch(acceptedBatch);
    }
  }

  return accepted;
};

// Datei die per Kontext-Menü / Kommandozeile übergeben wurde
const getFileArgument = (argv: string[]): string | null => {
  // In packaged form: argv = ['path/to/exe', 'path/to/file']
  // In dev: argv = ['electron', '.', 'path/to/file']
  const args = app.isPackaged ? argv.slice(1) : argv.slice(2);
  const filePath = args.find(
    (a) => !a.startsWith('-') && (a.endsWith('.log') || a.endsWith('.txt') || a.endsWith('.xml'))
  );
  return filePath ?? null;
};

const openFileInRenderer = (filePath: string) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send('open-file-from-cli', filePath);
  }
};

const RELEASES_LATEST_API_URL = 'https://api.github.com/repos/DrScince/LogStudio/releases/latest';
const RELEASES_PAGE_URL = 'https://github.com/DrScince/LogStudio/releases';

const normalizeVersion = (version: string): string => version.replace(/^v/i, '').split('-')[0];

const isVersionNewer = (latest: string, current: string): boolean => {
  const latestParts = normalizeVersion(latest).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const currentParts = normalizeVersion(current).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < maxLength; i++) {
    if ((latestParts[i] ?? 0) > (currentParts[i] ?? 0)) return true;
    if ((latestParts[i] ?? 0) < (currentParts[i] ?? 0)) return false;
  }
  return false;
};

const fetchLatestRelease = (): Promise<{ tagName: string; htmlUrl: string }> => {
  return new Promise((resolve, reject) => {
    const request = net.request({ url: RELEASES_LATEST_API_URL, method: 'GET' });
    request.setHeader('User-Agent', 'LogStudio');
    request.setHeader('Accept', 'application/vnd.github+json');
    let data = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`GitHub API responded with status ${response.statusCode}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const tagName = typeof parsed.tag_name === 'string' ? parsed.tag_name : '';
          if (!tagName) { reject(new Error('No tag_name')); return; }
          resolve({ tagName, htmlUrl: typeof parsed.html_url === 'string' ? parsed.html_url : RELEASES_PAGE_URL });
        } catch (e) { reject(e); }
      });
    });
    request.on('error', reject);
    request.end();
  });
};

const isPortable = (): boolean => !!process.env.PORTABLE_EXECUTABLE_DIR;

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  if (isPortable()) {
    // Portable: nur GitHub-API prüfen und Banner anzeigen, kein Auto-Update
    fetchLatestRelease()
      .then((release) => {
        if (isVersionNewer(release.tagName, app.getVersion())) {
          mainWindow?.webContents.send('update-available', {
            version: normalizeVersion(release.tagName),
            portable: true,
            releaseUrl: release.htmlUrl || RELEASES_PAGE_URL,
          });
        } else {
          mainWindow?.webContents.send('update-not-available');
        }
      })
      .catch(() => {});
    return;
  }

  // NSIS-Installation: vollautomatischer Update-Prozess
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', { version: info.version, portable: false });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-download-progress', { percent: progress.percent });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-error', { message: err.message });
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

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

  const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    const waitForDevServer = async (url: string, attempts = 40): Promise<void> => {
      for (let i = 0; i < attempts; i++) {
        try {
          const res = await fetch(url, { method: 'GET' });
          if (res.ok || res.status === 404) return;
        } catch {
          /* not ready yet */
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error(`Dev server not reachable at ${url}`);
    };

    waitForDevServer(devUrl)
      .then(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        void mainWindow.loadURL(devUrl);
      })
      .catch((err) => {
        console.error(err);
        if (!mainWindow || mainWindow.isDestroyed()) return;
        void mainWindow.loadURL(
          `data:text/html,<h2 style="font-family:sans-serif;color:#e6edf3;background:#0d1117;padding:2rem">LogStudio Dev Server nicht erreichbar (${devUrl}). Bitte \`npm run dev\` neu starten und Port 5173 freigeben.</h2>`
        );
      });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  }

  // Verhindert Navigation bei Datei-Drops auf das Fenster
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());

  // Keyboard shortcut to toggle DevTools (F12 or Ctrl+Shift+I) - always available in dev mode
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (isDev) {
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
  setupAutoUpdater();

  // Datei öffnen die beim Start als Argument übergeben wurde
  const fileArg = getFileArgument(process.argv);
  if (fileArg) {
    mainWindow?.webContents.once('did-finish-load', () => {
      openFileInRenderer(fileArg);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Single-Instance: wenn LogStudio bereits läuft und eine zweite Instanz
// mit einer Datei gestartet wird, Fokus auf bestehende und Datei öffnen
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const fileArg = getFileArgument(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    if (fileArg) openFileInRenderer(fileArg);
  });
}

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

ipcMain.handle('write-xml-file', async (event, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8');
    return { success: true };
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

ipcMain.handle('list-log-files', async (event, directory: string, includeSubdirectories: boolean = false) => {
  try {
    const candidates = sortCandidatesNewestFirst(
      await scanDirCandidates(directory, includeSubdirectories)
    );
    const logFiles = await filterTextFilesInBatches(candidates, 200);
    return { success: true, files: logFiles };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle(
  'list-log-files-stream',
  async (event, directory: string, includeSubdirectories: boolean = false, requestId: string) => {
    const sender = event.sender;

    // Start async scan and return immediately so renderer can begin rendering batches.
    void (async () => {
      try {
        const candidates = sortCandidatesNewestFirst(
          await scanDirCandidates(directory, includeSubdirectories)
        );

        await filterTextFilesInBatches(candidates, 200, (batch) => {
          try {
            sender.send('list-log-files-progress', { requestId, files: batch, done: false });
          } catch {
            // Ignore send errors if renderer is gone
          }
        });

        try {
          sender.send('list-log-files-progress', { requestId, files: [], done: true });
        } catch {
          // Ignore send errors if renderer is gone
        }
      } catch (error) {
        try {
          sender.send('list-log-files-progress', {
            requestId,
            files: [],
            done: true,
            error: String(error),
          });
        } catch {
          // Ignore send errors if renderer is gone
        }
      }
    })();

    return { success: true };
  }
);

ipcMain.handle('watch-directory', (event, directory: string) => {
  if (dirWatchers.has(directory)) {
    return { success: true, alreadyWatching: true };
  }
  try {
    const watcher = chokidar.watch(directory, {
      persistent: true,
      ignoreInitial: true,
      depth: 0, // only top-level directory entries
      usePolling: false,
    });

    const notify = () => {
      if (mainWindow) {
        mainWindow.webContents.send('directory-changed', directory);
      }
    };

    watcher.on('add', notify);
    watcher.on('unlink', notify);
    watcher.on('error', (err) => console.error('Directory watcher error:', err));

    dirWatchers.set(directory, watcher);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('unwatch-directory', (event, directory: string) => {
  const watcher = dirWatchers.get(directory);
  if (watcher) {
    watcher.close();
    dirWatchers.delete(directory);
    return { success: true };
  }
  return { success: false, error: 'Directory watcher not found' };
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

ipcMain.handle('get-app-version', () => {
  return { success: true, version: app.getVersion() };
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
        { name: 'Log & Config Files', extensions: ['log', 'txt', 'xml', 'md'] },
        { name: 'Log Files', extensions: ['log', 'txt'] },
        { name: 'XML Files', extensions: ['xml'] },
        { name: 'Markdown', extensions: ['md', 'markdown'] },
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

ipcMain.handle('show-open-files-dialog', async () => {
  if (!mainWindow) {
    return { success: false, error: 'Main window not available' };
  }

  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Dateien auswählen',
      filters: [
        { name: 'Log & Config Files', extensions: ['log', 'txt', 'xml', 'json', 'md'] },
        { name: 'Log Files', extensions: ['log', 'txt'] },
        { name: 'XML Files', extensions: ['xml'] },
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, filePaths: result.filePaths };
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

ipcMain.handle(
  'export-html-to-pdf',
  async (event, html: string, defaultFileName?: string) => {
    if (!mainWindow) {
      return { success: false, error: 'Main window not available' };
    }

    const sendProgress = (percent: number, stage: string) => {
      try {
        event.sender.send('export-pdf-progress', { percent, stage });
      } catch {
        /* ignore */
      }
    };

    const withTimeout = async <T,>(
      promise: Promise<T>,
      ms: number,
      label: string
    ): Promise<T> => {
      let timer: NodeJS.Timeout | undefined;
      try {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    try {
      sendProgress(5, 'dialog');
      const suggested =
        defaultFileName && defaultFileName.trim()
          ? defaultFileName.replace(/\.md$/i, '').replace(/\.pdf$/i, '') + '.pdf'
          : 'document.pdf';

      const saveResult = await dialog.showSaveDialog(mainWindow, {
        title: 'Als PDF exportieren',
        defaultPath: suggested,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { success: false, canceled: true };
      }

      sendProgress(20, 'prepare');
      // Drop remote font/css references that can hang Chromium offline.
      const safeHtml = html
        .replace(/@import\s+[^;]+;/gi, '')
        .replace(/url\(\s*['"]?https?:\/\/[^)'"]+['"]?\s*\)/gi, 'none');

      const tmpPath = path.join(
        app.getPath('temp'),
        `logstudio-md-export-${Date.now()}.html`
      );
      await fs.promises.writeFile(tmpPath, safeHtml, 'utf-8');

      sendProgress(35, 'load');
      const exportWindow = new BrowserWindow({
        show: false,
        width: 1024,
        height: 768,
        webPreferences: {
          sandbox: false,
          contextIsolation: true,
          nodeIntegration: false,
          images: true,
          javascript: false,
        },
      });

      // Cancel any non-local network requests (fonts/CDNs) so load cannot hang.
      try {
        exportWindow.webContents.session.webRequest.onBeforeRequest(
          { urls: ['*://*/*'] },
          (details, callback) => {
            if (
              details.url.startsWith('file:') ||
              details.url.startsWith('data:') ||
              details.url.startsWith('about:')
            ) {
              callback({});
            } else {
              callback({ cancel: true });
            }
          }
        );
      } catch {
        /* ignore */
      }

      try {
        const fileUrl = pathToFileURL(tmpPath).href;
        await withTimeout(
          exportWindow.loadURL(fileUrl),
          12000,
          'Loading PDF preview'
        );

        sendProgress(55, 'layout');
        await new Promise((resolve) => setTimeout(resolve, 150));

        sendProgress(70, 'render');
        const pdf = await withTimeout(
          exportWindow.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
            margins: { marginType: 'default' },
            preferCSSPageSize: true,
          }),
          20000,
          'Rendering PDF'
        );

        sendProgress(90, 'save');
        await fs.promises.writeFile(saveResult.filePath, pdf);
        sendProgress(100, 'done');
        return { success: true, filePath: saveResult.filePath };
      } finally {
        if (!exportWindow.isDestroyed()) exportWindow.destroy();
        await fs.promises.unlink(tmpPath).catch(() => undefined);
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
);

// Fenstersteuerung
ipcMain.handle(
  'write-clipboard',
  async (_event, payload: { text?: string; rtf?: string; html?: string }) => {
    try {
      const data: Electron.Data = {};
      if (typeof payload?.text === 'string') data.text = payload.text;
      if (typeof payload?.rtf === 'string') data.rtf = payload.rtf;
      if (typeof payload?.html === 'string') data.html = payload.html;
      if (!data.text && !data.rtf && !data.html) {
        return { success: false, error: 'No clipboard content provided' };
      }
      clipboard.write(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
);

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

ipcMain.handle('show-item-in-folder', async (_event, filePath: string) => {
  const { shell } = await import('electron');
  const normalized = path.normalize(filePath);

  if (!fs.existsSync(normalized)) {
    return { success: false, error: 'File not found' };
  }

  shell.showItemInFolder(normalized);
  return { success: true };
});

ipcMain.handle('open-file-in-editor', async (_event, filePath: string, lineNumber: number, editorOrder?: string[]) => {
  const { exec } = await import('child_process');
  const escaped = filePath.replace(/"/g, '\\"');
  const order = editorOrder ?? ['vscode', 'notepadplusplus', 'notepad'];

  const notepadPlusPlusPaths = [
    'notepad++',
    'C:\\Program Files\\Notepad++\\notepad++.exe',
    'C:\\Program Files (x86)\\Notepad++\\notepad++.exe',
  ];

  const tryCmd = (cmd: string): Promise<boolean> =>
    new Promise((resolve) => exec(cmd, (err) => resolve(!err)));

  const tryEditors = async (remaining: string[]): Promise<{ success: boolean }> => {
    if (remaining.length === 0) return { success: false };
    const [editor, ...rest] = remaining;

    if (editor === 'vscode') {
      const ok = await tryCmd(`code --goto "${escaped}:${lineNumber}"`);
      if (ok) return { success: true };
    } else if (editor === 'notepadplusplus') {
      for (const nppPath of notepadPlusPlusPaths) {
        const ok = await tryCmd(`"${nppPath}" -n${lineNumber} "${escaped}"`);
        if (ok) return { success: true };
      }
    } else if (editor === 'notepad') {
      await tryCmd(`notepad "${escaped}"`);
      return { success: true };
    }

    return tryEditors(rest);
  };

  return tryEditors(order);
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
  if (!app.isPackaged) return { success: false, error: 'Not packaged' };
  try {
    if (isPortable()) {
      const release = await fetchLatestRelease();
      if (isVersionNewer(release.tagName, app.getVersion())) {
        mainWindow?.webContents.send('update-available', {
          version: normalizeVersion(release.tagName),
          portable: true,
          releaseUrl: release.htmlUrl || RELEASES_PAGE_URL,
        });
      } else {
        mainWindow?.webContents.send('update-not-available');
      }
    } else {
      await autoUpdater.checkForUpdates();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});
