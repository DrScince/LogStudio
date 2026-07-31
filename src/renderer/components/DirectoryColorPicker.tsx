import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DIRECTORY_COLORS,
  getDirectoryColor,
  isCustomDirectoryColor,
  normalizeHexColor,
  resolveDirectoryColorValue,
} from '../utils/directoryIcons';
import { useTranslation } from '../i18n';
import './DirectoryPickers.css';

interface DirectoryColorPickerProps {
  value?: string;
  onChange: (colorId: string | undefined) => void;
  clearLabel?: string;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const normalized = normalizeHexColor(hex) ?? '#58a6ff';
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const DirectoryColorPicker: React.FC<DirectoryColorPickerProps> = ({
  value,
  onChange,
  clearLabel = 'None',
}) => {
  const { t } = useTranslation();
  const resolvedHex = getDirectoryColor(value) ?? '#58a6ff';
  const customSelected = isCustomDirectoryColor(value);
  const [customOpen, setCustomOpen] = useState(customSelected);
  const [hsv, setHsv] = useState(() => hexToHsv(resolvedHex));
  const [hexDraft, setHexDraft] = useState(resolvedHex);
  const svRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  useEffect(() => {
    const next = getDirectoryColor(value) ?? '#58a6ff';
    setHsv(hexToHsv(next));
    setHexDraft(next);
    if (isCustomDirectoryColor(value)) setCustomOpen(true);
  }, [value]);

  const hueColor = useMemo(() => hsvToHex(hsv.h, 1, 1), [hsv.h]);
  const previewHex = useMemo(() => hsvToHex(hsv.h, hsv.s, hsv.v), [hsv]);

  const commitHsv = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    setHexDraft(hex);
    onChange(resolveDirectoryColorValue(hex));
  };

  const pickFromSv = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const v = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    commitHsv({ ...hsvRef.current, s, v });
  };

  useEffect(() => {
    if (!customOpen) return;
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      pickFromSv(e.clientX, e.clientY);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [customOpen]);

  const applyHexDraft = () => {
    const normalized = normalizeHexColor(hexDraft);
    if (!normalized) {
      setHexDraft(previewHex);
      return;
    }
    setHsv(hexToHsv(normalized));
    setHexDraft(normalized);
    onChange(resolveDirectoryColorValue(normalized));
  };

  return (
    <div className="dir-color-picker-wrap">
      <div className="dir-color-picker">
        <button
          type="button"
          className={`dir-color-swatch dir-color-swatch-none ${!value ? 'selected' : ''}`}
          title={clearLabel}
          onClick={() => {
            setCustomOpen(false);
            onChange(undefined);
          }}
        >
          <span className="dir-color-swatch-slash" />
        </button>
        {DIRECTORY_COLORS.map(({ id, hex, label }) => (
          <button
            key={id}
            type="button"
            className={`dir-color-swatch ${value === id ? 'selected' : ''}`}
            title={label}
            aria-label={label}
            data-color={id}
            style={{ '--swatch-color': hex } as React.CSSProperties}
            onClick={() => {
              setCustomOpen(false);
              onChange(id);
            }}
          >
            <span className="dir-color-swatch-fill" />
          </button>
        ))}
        <button
          type="button"
          className={`dir-color-swatch dir-color-swatch-custom ${customSelected || customOpen ? 'selected' : ''}`}
          title={t('sidebar.customColor')}
          aria-label={t('sidebar.customColor')}
          aria-expanded={customOpen}
          style={
            {
              '--swatch-color': customSelected ? resolvedHex : 'transparent',
            } as React.CSSProperties
          }
          onClick={() => {
            setCustomOpen((open) => {
              const next = !open;
              if (next && !customSelected) {
                onChange(resolveDirectoryColorValue(previewHex));
              }
              return next;
            });
          }}
        >
          <span className="dir-color-swatch-custom-glyph" aria-hidden>
            {customSelected ? (
              <span className="dir-color-swatch-fill" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            )}
          </span>
        </button>
      </div>

      {customOpen && (
        <div className="dir-color-custom-panel" onMouseDown={(e) => e.stopPropagation()}>
          <div
            ref={svRef}
            className="dir-color-sv"
            style={{ backgroundColor: hueColor }}
            onMouseDown={(e) => {
              e.preventDefault();
              dragging.current = true;
              pickFromSv(e.clientX, e.clientY);
            }}
          >
            <div className="dir-color-sv-white" />
            <div className="dir-color-sv-black" />
            <span
              className="dir-color-sv-thumb"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
            />
          </div>
          <input
            type="range"
            className="dir-color-hue"
            min={0}
            max={360}
            value={Math.round(hsv.h)}
            aria-label={t('sidebar.customColor')}
            onChange={(e) => commitHsv({ ...hsv, h: Number(e.target.value) })}
          />
          <div className="dir-color-hex-row">
            <span
              className="dir-color-preview"
              style={{ backgroundColor: previewHex }}
              aria-hidden
            />
            <input
              className="dir-color-hex-input"
              value={hexDraft}
              spellCheck={false}
              aria-label={t('sidebar.customColorHex')}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={applyHexDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyHexDraft();
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectoryColorPicker;
