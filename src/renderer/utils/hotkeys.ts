import { HotkeyBinding } from './settings';

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta']);

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key);
}

export function matchesBinding(
  e: KeyboardEvent | React.KeyboardEvent,
  binding: HotkeyBinding,
  options?: { chordPending?: boolean },
): boolean {
  if (binding.chord) {
    if (options?.chordPending) {
      return e.key.toLowerCase() === binding.key.toLowerCase();
    }
    return false;
  }

  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl !== binding.ctrl) return false;
  if (e.altKey !== binding.alt) return false;
  if (e.shiftKey !== binding.shift) return false;
  return e.key.toLowerCase() === binding.key.toLowerCase();
}

export function isChordStarter(e: KeyboardEvent | React.KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
}

export function formatHotkey(binding: HotkeyBinding): string {
  if (binding.chord) {
    return `Ctrl+K, ${formatKey(binding.key)}`;
  }
  const parts: string[] = [];
  if (binding.ctrl) parts.push('Ctrl');
  if (binding.alt) parts.push('Alt');
  if (binding.shift) parts.push('Shift');
  parts.push(formatKey(binding.key));
  return parts.join('+');
}

function formatKey(key: string): string {
  switch (key) {
    case 'ArrowUp': return '↑';
    case 'ArrowDown': return '↓';
    case 'ArrowLeft': return '←';
    case 'ArrowRight': return '→';
    case 'Delete': return 'Del';
    case 'Escape': return 'Esc';
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

export function bindingFromKeyboardEvent(e: KeyboardEvent): HotkeyBinding | null {
  if (isModifierKey(e.key)) return null;
  return {
    ctrl: e.ctrlKey || e.metaKey,
    alt: e.altKey,
    shift: e.shiftKey,
    key: e.key,
  };
}
