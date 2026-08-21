import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type AiComponentPreference = {
  aiEnabled: boolean;
  source?: string;
  pendingChoice?: boolean;
};

function installRootDir(): string {
  // Packaged: <installDir>/resources → parent is install dir
  // Dev: no installer flag
  if (app.isPackaged) {
    return path.join(process.resourcesPath, '..');
  }
  return app.getPath('userData');
}

export function aiComponentFlagPath(): string {
  return path.join(installRootDir(), 'ai-component.json');
}

export function userAiChoicePath(): string {
  return path.join(app.getPath('userData'), 'ai-component.json');
}

export function readAiComponentPreference(): AiComponentPreference | null {
  const candidates = [aiComponentFlagPath(), userAiChoicePath()];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (typeof parsed?.aiEnabled === 'boolean') {
        return {
          aiEnabled: parsed.aiEnabled,
          source: typeof parsed.source === 'string' ? parsed.source : undefined,
          pendingChoice: parsed.pendingChoice === true,
        };
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function writeAiComponentPreference(pref: AiComponentPreference): void {
  const targets = app.isPackaged
    ? [aiComponentFlagPath(), userAiChoicePath()]
    : [userAiChoicePath()];
  const body = JSON.stringify({ ...pref, updatedAt: new Date().toISOString() }, null, 2);
  for (const target of targets) {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body, 'utf8');
    } catch (err) {
      console.error('Failed to write AI component preference', target, err);
    }
  }
}

/** True when no installer/user choice exists yet (e.g. portable / AppImage / first run). */
export function needsAiInstallChoice(): boolean {
  return readAiComponentPreference() === null;
}

export function getBundledOllamaBinary(): string | null {
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
