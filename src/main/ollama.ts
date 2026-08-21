import { app, shell } from 'electron';
import { spawn, execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

export const DEFAULT_OLLAMA_BASE = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b';

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
  const candidates = [
    'ollama',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
    path.join(process.env.ProgramFiles || '', 'Ollama', 'ollama.exe'),
    '/usr/local/bin/ollama',
    '/usr/bin/ollama',
    path.join(app.getPath('home'), '.local', 'bin', 'ollama'),
  ];
  for (const c of candidates) {
    if (!c || c === 'ollama') continue;
    try {
      await fs.promises.access(c, fs.constants.X_OK);
      return true;
    } catch {
      /* continue */
    }
  }
  return await new Promise((resolve) => {
    execFile('ollama', ['--version'], { timeout: 3000 }, (err) => resolve(!err));
  });
}

export async function openOllamaDownloadPage(): Promise<void> {
  await shell.openExternal('https://ollama.com/download');
}

/** Best-effort local install for Linux prototypes; otherwise open download page. */
export async function installOllama(): Promise<{ success: boolean; message: string }> {
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
          // Try starting the service
          spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' }).unref();
          resolve({ success: true, message: out.slice(-500) || 'Ollama installed' });
        } else {
          resolve({ success: false, message: out.slice(-800) || `Install failed (${code})` });
        }
      });
      child.on('error', (err) => resolve({ success: false, message: String(err) }));
    });
  }

  await openOllamaDownloadPage();
  return {
    success: true,
    message:
      process.platform === 'win32' || process.platform === 'darwin'
        ? 'Opened Ollama download page. Install Ollama, then click Refresh.'
        : 'Please install Ollama manually, then click Refresh.',
  };
}

export async function ensureOllamaRunning(baseUrl = DEFAULT_OLLAMA_BASE): Promise<boolean> {
  const status = await getOllamaStatus(baseUrl);
  if (status.running) return true;
  try {
    spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' }).unref();
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

export function buildLogAssistantSystemPrompt(): string {
  return [
    'You are LogStudio AI, a local assistant that helps developers understand log files.',
    'Explain errors clearly and practically. Prefer concise German answers unless the user writes in another language.',
    'When given a log entry, cover: what happened, likely cause, and concrete next checks.',
    'Do not invent stack frames or file paths that are not in the provided context.',
  ].join(' ');
}
