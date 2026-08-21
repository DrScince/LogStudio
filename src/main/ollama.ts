import { app, shell } from 'electron';
import { spawn, execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

export const DEFAULT_OLLAMA_BASE = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b';

function getBundledOllamaBinary(): string | null {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'ollama')
    : path.join(app.getAppPath(), 'vendor', 'ollama');
  const name = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
  const candidate = path.join(base, name);
  try {
    if (fs.existsSync(candidate)) return candidate;
  } catch {
    /* ignore */
  }
  return null;
}

function resolveOllamaBinary(): string | null {
  const bundled = getBundledOllamaBinary();
  if (bundled) return bundled;
  if (process.platform === 'win32') {
    const local = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe');
    const prog = path.join(process.env.ProgramFiles || '', 'Ollama', 'ollama.exe');
    if (fs.existsSync(local)) return local;
    if (fs.existsSync(prog)) return prog;
  }
  if (process.platform === 'linux' || process.platform === 'darwin') {
    for (const c of [
      '/usr/local/bin/ollama',
      '/usr/bin/ollama',
      path.join(app.getPath('home'), '.local', 'bin', 'ollama'),
    ]) {
      if (fs.existsSync(c)) return c;
    }
  }
  return null;
}

export type OllamaStatus = {
  installed: boolean;
  running: boolean;
  baseUrl: string;
  version?: string;
  models: string[];
  error?: string;
};

function requestJson(
  url: string,
  options: { method?: string; body?: unknown; timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; json?: any; text?: string }> {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const bodyStr = options.body !== undefined ? JSON.stringify(options.body) : undefined;
      const req = lib.request(
        {
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: u.pathname + u.search,
          method: options.method || 'GET',
          headers: bodyStr
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
            : undefined,
          timeout: options.timeoutMs ?? 8000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let json: any;
            try {
              json = text ? JSON.parse(text) : undefined;
            } catch {
              /* ignore */
            }
            resolve({ ok: (res.statusCode ?? 500) < 400, status: res.statusCode ?? 0, json, text });
          });
        }
      );
      req.on('error', (err) => resolve({ ok: false, status: 0, text: String(err) }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, status: 0, text: 'timeout' });
      });
      if (bodyStr) req.write(bodyStr);
      req.end();
    } catch (err) {
      resolve({ ok: false, status: 0, text: String(err) });
    }
  });
}

export async function getOllamaStatus(baseUrl = DEFAULT_OLLAMA_BASE): Promise<OllamaStatus> {
  const installed = await isOllamaBinaryPresent();
  const tags = await requestJson(`${baseUrl.replace(/\/$/, '')}/api/tags`, { timeoutMs: 3000 });
  if (!tags.ok) {
    return {
      installed,
      running: false,
      baseUrl,
      models: [],
      error: tags.text || 'Ollama not reachable',
    };
  }
  const models = Array.isArray(tags.json?.models)
    ? tags.json.models.map((m: any) => String(m.name || m.model || '')).filter(Boolean)
    : [];
  const versionRes = await requestJson(`${baseUrl.replace(/\/$/, '')}/api/version`, { timeoutMs: 3000 });
  return {
    installed: true,
    running: true,
    baseUrl,
    version: versionRes.json?.version ? String(versionRes.json.version) : undefined,
    models,
  };
}

async function isOllamaBinaryPresent(): Promise<boolean> {
  const resolved = resolveOllamaBinary();
  if (resolved) {
    try {
      await fs.promises.access(resolved, fs.constants.F_OK);
      return true;
    } catch {
      /* fall through */
    }
  }
  return await new Promise((resolve) => {
    execFile('ollama', ['--version'], { timeout: 3000 }, (err) => resolve(!err));
  });
}

export async function openOllamaDownloadPage(): Promise<void> {
  await shell.openExternal('https://ollama.com/download');
}

const OLLAMA_WIN_SETUP_URL = 'https://ollama.com/download/OllamaSetup.exe';
const OLLAMA_MAC_ZIP_URL = 'https://ollama.com/download/Ollama-darwin.zip';

function installerDownloadDir(): string {
  // Prefer Downloads / userData — %TEMP% is often blocked for .exe by AV / policy (EPERM).
  try {
    const downloads = app.getPath('downloads');
    if (downloads) return downloads;
  } catch {
    /* ignore */
  }
  return path.join(app.getPath('userData'), 'ollama-setup');
}

/** Windows: download + launch entirely via PowerShell (system certs, no Electron file locks). */
function downloadAndLaunchWithPowerShell(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
    } catch {
      /* ignore */
    }
    const ps = `
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$dest = '${dest.replace(/'/g, "''")}'
$uri = '${url.replace(/'/g, "''")}'
$dir = Split-Path -Parent $dest
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
if (-not (Test-Path $dest) -or (Get-Item $dest).Length -lt 1000000) {
  Invoke-WebRequest -Uri $uri -OutFile $dest -UseBasicParsing
}
Start-Process -FilePath $dest
`;
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { timeout: 600000, windowsHide: true },
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

/**
 * On Windows we intentionally avoid writing the .exe from Electron/Node
 * (Temp + AV often causes EPERM / uncaught exceptions). PowerShell or the
 * browser download are more reliable in corporate environments.
 */
async function launchWindowsOllamaInstaller(): Promise<{ success: boolean; message: string }> {
  const dest = path.join(installerDownloadDir(), 'OllamaSetup-LogStudio.exe');
  try {
    await downloadAndLaunchWithPowerShell(OLLAMA_WIN_SETUP_URL, dest);
    return {
      success: true,
      message: 'Ollama installer launched. Finish setup, then click Refresh.',
    };
  } catch (err) {
    console.warn('PowerShell Ollama install failed, opening browser download…', err);
    try {
      await shell.openExternal(OLLAMA_WIN_SETUP_URL);
      return {
        success: true,
        message:
          'Browser download started (OllamaSetup.exe). Run the installer, then click Refresh here.',
      };
    } catch (openErr) {
      await openOllamaDownloadPage();
      return {
        success: false,
        message: `Could not start Ollama setup (${String(openErr)}). Opened the download page.`,
      };
    }
  }
}

async function launchMacOllamaInstaller(): Promise<{ success: boolean; message: string }> {
  try {
    await shell.openExternal(OLLAMA_MAC_ZIP_URL);
    return {
      success: true,
      message: 'Ollama download opened in your browser. Install the app, then click Refresh.',
    };
  } catch (err) {
    await openOllamaDownloadPage();
    return {
      success: false,
      message: `Could not open download (${String(err)}). Opened the Ollama website.`,
    };
  }
}

/**
 * Launch the platform Ollama installer when the user starts using AI.
 * Must never throw — failures are returned as messages.
 */
export async function installOllama(): Promise<{ success: boolean; message: string }> {
  try {
    if (await isOllamaBinaryPresent()) {
      const running = await ensureOllamaRunning();
      return {
        success: true,
        message: running
          ? 'Ollama is already installed and running.'
          : 'Ollama is installed. Starting service…',
      };
    }

    if (process.platform === 'win32') {
      return await launchWindowsOllamaInstaller();
    }
    if (process.platform === 'darwin') {
      return await launchMacOllamaInstaller();
    }
    if (process.platform === 'linux') {
      return await new Promise((resolve) => {
        const child = spawn('bash', ['-lc', 'curl -fsSL https://ollama.com/install.sh | sh'], {
          env: process.env,
        });
        let out = '';
        child.stdout.on('data', (d) => {
          out += d.toString();
        });
        child.stderr.on('data', (d) => {
          out += d.toString();
        });
        child.on('close', (code) => {
          if (code === 0) {
            const bin = resolveOllamaBinary() || 'ollama';
            spawn(bin, ['serve'], { detached: true, stdio: 'ignore' }).unref();
            resolve({ success: true, message: out.slice(-500) || 'Ollama installed' });
          } else {
            void openOllamaDownloadPage().then(() =>
              resolve({
                success: false,
                message: out.slice(-800) || `Install failed (${code}). Opened download page.`,
              })
            );
          }
        });
        child.on('error', (err) => {
          void openOllamaDownloadPage().then(() =>
            resolve({ success: false, message: String(err) })
          );
        });
      });
    }

    await openOllamaDownloadPage();
    return { success: true, message: 'Opened Ollama download page.' };
  } catch (err) {
    console.error('installOllama failed', err);
    try {
      await openOllamaDownloadPage();
    } catch {
      /* ignore */
    }
    return {
      success: false,
      message: `Setup failed (${String(err)}). Opened the Ollama download page if possible.`,
    };
  }
}

export async function ensureOllamaRunning(baseUrl = DEFAULT_OLLAMA_BASE): Promise<boolean> {
  const status = await getOllamaStatus(baseUrl);
  if (status.running) return true;
  const bin = resolveOllamaBinary() || 'ollama';
  try {
    spawn(bin, ['serve'], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    return false;
  }
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const s = await getOllamaStatus(baseUrl);
    if (s.running) return true;
  }
  return false;
}

export async function pullOllamaModel(
  model: string,
  baseUrl = DEFAULT_OLLAMA_BASE,
  onProgress?: (info: { status: string; percent?: number }) => void
): Promise<{ success: boolean; error?: string }> {
  const running = await ensureOllamaRunning(baseUrl);
  if (!running) return { success: false, error: 'Ollama is not running' };

  return await new Promise((resolve) => {
    const u = new URL(`${baseUrl.replace(/\/$/, '')}/api/pull`);
    const body = JSON.stringify({ name: model, stream: true });
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let buf = '';
        res.on('data', (chunk) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              const total = Number(evt.total || 0);
              const completed = Number(evt.completed || 0);
              const percent = total > 0 ? Math.round((completed / total) * 100) : undefined;
              onProgress?.({ status: String(evt.status || 'downloading'), percent });
              if (evt.error) {
                resolve({ success: false, error: String(evt.error) });
              }
            } catch {
              /* ignore partial */
            }
          }
        });
        res.on('end', () => resolve({ success: (res.statusCode ?? 500) < 400 }));
      }
    );
    req.on('error', (err) => resolve({ success: false, error: String(err) }));
    req.write(body);
    req.end();
  });
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chatWithOllama(params: {
  model: string;
  messages: ChatMessage[];
  baseUrl?: string;
  onToken?: (token: string) => void;
}): Promise<{ success: boolean; content?: string; error?: string }> {
  const baseUrl = params.baseUrl || DEFAULT_OLLAMA_BASE;
  const running = await ensureOllamaRunning(baseUrl);
  if (!running) return { success: false, error: 'Ollama is not running' };

  return await new Promise((resolve) => {
    const u = new URL(`${baseUrl.replace(/\/$/, '')}/api/chat`);
    const body = JSON.stringify({
      model: params.model,
      messages: params.messages,
      stream: true,
    });
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let buf = '';
        let content = '';
        res.on('data', (chunk) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const evt = JSON.parse(line);
              const token = evt.message?.content ? String(evt.message.content) : '';
              if (token) {
                content += token;
                params.onToken?.(token);
              }
              if (evt.error) {
                resolve({ success: false, error: String(evt.error) });
              }
            } catch {
              /* ignore */
            }
          }
        });
        res.on('end', () => {
          if ((res.statusCode ?? 500) >= 400) {
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
          } else {
            resolve({ success: true, content });
          }
        });
      }
    );
    req.on('error', (err) => resolve({ success: false, error: String(err) }));
    req.setTimeout(120000, () => {
      req.destroy();
      resolve({ success: false, error: 'Chat timed out' });
    });
    req.write(body);
    req.end();
  });
}

export function buildLogAssistantSystemPrompt(fileContext?: {
  fileName: string;
  excerpt: string;
  note?: string;
}): string {
  const base = [
    'You are LogStudio AI, a local assistant that helps developers understand log files.',
    'Explain errors clearly and practically. Prefer concise German answers unless the user writes in another language.',
    'When analyzing logs, cover: what happened, likely cause, and concrete next checks.',
    'Do not invent stack frames, timestamps, or file paths that are not in the provided context.',
    'Always ground your answer in the provided log context from the currently open file.',
  ].join(' ');

  if (!fileContext?.excerpt?.trim()) {
    return (
      base +
      ' No log file context is currently attached. Ask the user to open a log file in LogStudio if needed.'
    );
  }

  return [
    base,
    '',
    `Current open log file: ${fileContext.fileName}`,
    fileContext.note ? `Context note: ${fileContext.note}` : '',
    '----- BEGIN LOG CONTEXT -----',
    fileContext.excerpt.trim(),
    '----- END LOG CONTEXT -----',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Keep the last portion of a log so the model sees recent errors without overflowing context. */
export function buildLogFileExcerpt(content: string, maxChars = 24000): {
  excerpt: string;
  truncated: boolean;
  lineCount: number;
} {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (normalized.length <= maxChars) {
    return { excerpt: normalized, truncated: false, lineCount: lines.length };
  }
  let excerpt = normalized.slice(-maxChars);
  const firstNl = excerpt.indexOf('\n');
  if (firstNl > 0 && firstNl < 200) excerpt = excerpt.slice(firstNl + 1);
  return {
    excerpt,
    truncated: true,
    lineCount: excerpt.split('\n').length,
  };
}
