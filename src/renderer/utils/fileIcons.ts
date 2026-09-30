import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBook,
  faBoxArchive,
  faBug,
  faCode,
  faCog,
  faCube,
  faCubes,
  faDatabase,
  faFile,
  faFileCode,
  faFileExcel,
  faFileLines,
  faFilePdf,
  faFileWord,
  faImage,
  faKey,
  faTerminal,
} from '@fortawesome/free-solid-svg-icons';

export interface FileIconInfo {
  icon: IconDefinition;
  /** CSS modifier class, e.g. "dll" → .log-file-item-icon--dll */
  colorClass: string;
}

/** Known compound suffixes checked before the last ".ext". */
const COMPOUND_SUFFIXES = [
  '.deps.json',
  '.runtimeconfig.json',
  '.staticwebassets.endpoints.json',
  '.min.js',
  '.min.css',
  '.d.ts',
];

export function getFileExtension(fileName: string): string {
  const lower = fileName.toLowerCase();
  for (const suffix of COMPOUND_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      if (suffix.endsWith('.json')) return 'json';
      if (suffix.endsWith('.js')) return 'js';
      if (suffix.endsWith('.css')) return 'css';
      if (suffix.endsWith('.ts')) return 'ts';
    }
  }
  const dot = lower.lastIndexOf('.');
  if (dot <= 0 || dot === lower.length - 1) return '';
  return lower.slice(dot + 1);
}

const EXT_ICONS: Record<string, FileIconInfo> = {
  // .NET / binaries
  dll: { icon: faCubes, colorClass: 'dll' },
  exe: { icon: faCube, colorClass: 'exe' },
  pdb: { icon: faBug, colorClass: 'pdb' },
  nupkg: { icon: faBoxArchive, colorClass: 'archive' },

  // Logs & plain text
  log: { icon: faFileLines, colorClass: 'log' },
  txt: { icon: faFileLines, colorClass: 'txt' },
  out: { icon: faFileLines, colorClass: 'log' },

  // Markup / data
  xml: { icon: faCode, colorClass: 'xml' },
  xaml: { icon: faCode, colorClass: 'xml' },
  html: { icon: faCode, colorClass: 'html' },
  htm: { icon: faCode, colorClass: 'html' },
  json: { icon: faFileCode, colorClass: 'json' },
  yml: { icon: faFileCode, colorClass: 'yaml' },
  yaml: { icon: faFileCode, colorClass: 'yaml' },
  csv: { icon: faFileExcel, colorClass: 'csv' },

  // Config
  config: { icon: faCog, colorClass: 'config' },
  conf: { icon: faCog, colorClass: 'config' },
  ini: { icon: faCog, colorClass: 'config' },
  env: { icon: faKey, colorClass: 'env' },
  props: { icon: faCog, colorClass: 'config' },
  targets: { icon: faCog, colorClass: 'config' },

  // Source
  js: { icon: faFileCode, colorClass: 'js' },
  mjs: { icon: faFileCode, colorClass: 'js' },
  cjs: { icon: faFileCode, colorClass: 'js' },
  jsx: { icon: faFileCode, colorClass: 'js' },
  ts: { icon: faFileCode, colorClass: 'ts' },
  tsx: { icon: faFileCode, colorClass: 'ts' },
  cs: { icon: faFileCode, colorClass: 'cs' },
  java: { icon: faFileCode, colorClass: 'java' },
  py: { icon: faFileCode, colorClass: 'py' },
  go: { icon: faFileCode, colorClass: 'go' },
  rs: { icon: faFileCode, colorClass: 'rs' },
  css: { icon: faFileCode, colorClass: 'css' },
  scss: { icon: faFileCode, colorClass: 'css' },
  less: { icon: faFileCode, colorClass: 'css' },
  sql: { icon: faDatabase, colorClass: 'sql' },
  sh: { icon: faTerminal, colorClass: 'shell' },
  bash: { icon: faTerminal, colorClass: 'shell' },
  ps1: { icon: faTerminal, colorClass: 'shell' },
  bat: { icon: faTerminal, colorClass: 'shell' },
  cmd: { icon: faTerminal, colorClass: 'shell' },

  // Docs / media
  md: { icon: faBook, colorClass: 'md' },
  markdown: { icon: faBook, colorClass: 'md' },
  pdf: { icon: faFilePdf, colorClass: 'pdf' },
  doc: { icon: faFileWord, colorClass: 'doc' },
  docx: { icon: faFileWord, colorClass: 'doc' },
  png: { icon: faImage, colorClass: 'image' },
  jpg: { icon: faImage, colorClass: 'image' },
  jpeg: { icon: faImage, colorClass: 'image' },
  gif: { icon: faImage, colorClass: 'image' },
  svg: { icon: faImage, colorClass: 'image' },
  webp: { icon: faImage, colorClass: 'image' },
  ico: { icon: faImage, colorClass: 'image' },

  // Archives
  zip: { icon: faBoxArchive, colorClass: 'archive' },
  gz: { icon: faBoxArchive, colorClass: 'archive' },
  tar: { icon: faBoxArchive, colorClass: 'archive' },
  '7z': { icon: faBoxArchive, colorClass: 'archive' },
  rar: { icon: faBoxArchive, colorClass: 'archive' },
};

const DEFAULT_ICON: FileIconInfo = { icon: faFile, colorClass: 'default' };

/** Special full-filename overrides (checked case-insensitively). */
const NAME_OVERRIDES: Record<string, FileIconInfo> = {
  'nlog.config': { icon: faCog, colorClass: 'config' },
  'appsettings.json': { icon: faCog, colorClass: 'json' },
  dockerfile: { icon: faCube, colorClass: 'docker' },
  'docker-compose.yml': { icon: faCube, colorClass: 'docker' },
  'docker-compose.yaml': { icon: faCube, colorClass: 'docker' },
  'package.json': { icon: faFileCode, colorClass: 'npm' },
  'tsconfig.json': { icon: faFileCode, colorClass: 'ts' },
};

export function getFileIconInfo(fileName: string): FileIconInfo {
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const lower = base.toLowerCase();
  if (NAME_OVERRIDES[lower]) return NAME_OVERRIDES[lower];
  const ext = getFileExtension(base);
  if (ext && EXT_ICONS[ext]) return EXT_ICONS[ext];
  return DEFAULT_ICON;
}
