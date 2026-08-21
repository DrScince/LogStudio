import React, { useState } from 'react';
import { AppSettings, LogSchema, EditorId, HotkeyId, HotkeyBinding, DEFAULT_HOTKEYS, DirectoryMeta } from '../utils/settings';
import { createWorkspace, createVirtualFolder, syncActiveWorkspaceDirs, fileBasename } from '../utils/workspaces';
import { useTranslation } from '../i18n';
import { LANGUAGE_LABELS, Language } from '../i18n/constants';
import { bindingFromKeyboardEvent, formatHotkey, isChordStarter, isModifierKey } from '../utils/hotkeys';
import { getDirectoryColor, getDirectoryIcon } from '../utils/directoryIcons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DirectoryIconPicker from './DirectoryIconPicker';
import DirectoryColorPicker from './DirectoryColorPicker';
import './SettingsPanel.css';

const EDITOR_LABELS: Record<EditorId, string> = {
  vscode: 'Visual Studio Code',
  notepadplusplus: 'Notepad++',
  notepad: 'Notepad (Windows)',
};

const FORMAT_GROUPS = [
  { key: 'pipe',   labelKey: 'settings.formatPipe'   as const },
  { key: 'log4j',  labelKey: 'settings.formatLog4j'  as const },
  { key: 'json',   labelKey: 'settings.formatJson'   as const },
  { key: 'logfmt', labelKey: 'settings.formatLogfmt' as const },
  { key: 'syslog', labelKey: 'settings.formatSyslog' as const },
  { key: 'apache', labelKey: 'settings.formatApache' as const },
  { key: 'german', labelKey: 'settings.formatGerman' as const },
];

type SettingsTab = 'general' | 'source' | 'schema' | 'tools';

const EDITOR_HOTKEYS: HotkeyId[] = ['save', 'format', 'comment', 'uncomment', 'cutLine', 'moveLineUp', 'moveLineDown'];
const SEARCH_HOTKEYS: HotkeyId[] = ['openSearch', 'nextMatch', 'prevMatch', 'showAllMatches'];

const HOTKEY_LABEL_KEYS: Record<HotkeyId, keyof TranslationKeys['settings']> = {
  save: 'hotkeySave',
  format: 'hotkeyFormat',
  comment: 'hotkeyComment',
  uncomment: 'hotkeyUncomment',
  cutLine: 'hotkeyCutLine',
  moveLineUp: 'hotkeyMoveLineUp',
  moveLineDown: 'hotkeyMoveLineDown',
  openSearch: 'hotkeyOpenSearch',
  nextMatch: 'hotkeyNextMatch',
  prevMatch: 'hotkeyPrevMatch',
  showAllMatches: 'hotkeyShowAllMatches',
};

type TranslationKeys = import('../i18n/en').TranslationKeys;

interface HotkeyCaptureProps {
  binding: HotkeyBinding;
  onChange: (binding: HotkeyBinding) => void;
  onReset: () => void;
  pressLabel: string;
  resetLabel: string;
}

const HotkeyCapture: React.FC<HotkeyCaptureProps> = ({ binding, onChange, onReset, pressLabel, resetLabel }) => {
  const [capturing, setCapturing] = useState(false);
  const [chordPending, setChordPending] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (isModifierKey(e.key)) return;

    if (binding.chord || chordPending) {
      if (isChordStarter(e)) {
        setChordPending(true);
        return;
      }
      onChange({ ctrl: false, alt: false, shift: false, key: e.key, chord: true });
      setCapturing(false);
      setChordPending(false);
      return;
    }

    const next = bindingFromKeyboardEvent(e.nativeEvent);
    if (next) {
      onChange(next);
      setCapturing(false);
      setChordPending(false);
    }
  };

  return (
    <div className="hotkey-capture-row">
      <button
        type="button"
        className={`hotkey-capture ${capturing ? 'capturing' : ''}`}
        onClick={() => { setCapturing(true); setChordPending(false); }}
        onKeyDown={handleKeyDown}
        onBlur={() => { setCapturing(false); setChordPending(false); }}
      >
        {capturing
          ? (chordPending || binding.chord ? `Ctrl+K, ${pressLabel}` : pressLabel)
          : formatHotkey(binding)}
      </button>
      <button type="button" className="hotkey-reset-btn" onClick={onReset} title={resetLabel}>
        {resetLabel}
      </button>
    </div>
  );
};

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, onClose }) => {
  const { t, setLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('source');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [patternError, setPatternError] = useState<string | null>(null);
  const [isSelectingDirectory, setIsSelectingDirectory] = useState(false);
  const [metaPickerDir, setMetaPickerDir] = useState<string | null>(null);
  const [metaPickerKind, setMetaPickerKind] = useState<'icon' | 'color' | null>(null);

  const REGEX_EXAMPLE = '^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d+)\\s*\\|\\s*([A-Z]+)\\s*\\|\\s*([^|]+)\\s*\\|\\s*(.+)$';

  const validatePattern = (pattern: string): boolean => {
    try {
      new RegExp(pattern);
      setPatternError(null);
      return true;
    } catch (e) {
      setPatternError(e instanceof Error ? e.message : 'Invalid regex pattern');
      return false;
    }
  };

  const handleSchemaChange = (field: keyof LogSchema, value: any) => {
    if (field === 'pattern') validatePattern(value);
    setLocalSettings({ ...localSettings, logSchema: { ...localSettings.logSchema, [field]: value } });
  };

  const handleFieldChange = (field: keyof LogSchema['fields'], value: number) => {
    setLocalSettings({
      ...localSettings,
      logSchema: {
        ...localSettings.logSchema,
        fields: { ...localSettings.logSchema.fields, [field]: value },
      },
    });
  };

  const handleSave = () => {
    onSettingsChange(syncActiveWorkspaceDirs(localSettings));
    onClose();
  };
  const handleCancel = () => { setLocalSettings(settings); onClose(); };

  const activeWorkspace =
    (localSettings.workspaces ?? []).find((w) => w.id === localSettings.activeWorkspaceId)
    ?? localSettings.workspaces?.[0];

  const handleSelectWorkspace = (id: string) => {
    if (id === localSettings.activeWorkspaceId) return;
    setLocalSettings((prev) => {
      const synced = syncActiveWorkspaceDirs(prev);
      const target = synced.workspaces.find((w) => w.id === id);
      if (!target) return synced;
      setMetaPickerDir(null);
      setMetaPickerKind(null);
      return {
        ...synced,
        activeWorkspaceId: id,
        logDirectories: [...target.logDirectories],
        virtualFolders: (target.virtualFolders ?? []).map((v) => ({
          ...v,
          filePaths: [...v.filePaths],
        })),
      };
    });
  };

  const handleWorkspaceNameChange = (name: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      workspaces: (prev.workspaces ?? []).map((w) =>
        w.id === prev.activeWorkspaceId ? { ...w, name } : w
      ),
    }));
  };

  const handleCreateWorkspace = () => {
    const name = t('workspace.newName', { n: (localSettings.workspaces?.length ?? 0) + 1 });
    const ws = createWorkspace(name, [], []);
    setLocalSettings((prev) => {
      const synced = syncActiveWorkspaceDirs(prev);
      return {
        ...synced,
        workspaces: [...synced.workspaces, ws],
        activeWorkspaceId: ws.id,
        logDirectories: [],
        virtualFolders: [],
      };
    });
    setMetaPickerDir(null);
    setMetaPickerKind(null);
  };

  const handleDeleteWorkspace = () => {
    setLocalSettings((prev) => {
      if ((prev.workspaces ?? []).length <= 1) return prev;
      const workspaces = prev.workspaces.filter((w) => w.id !== prev.activeWorkspaceId);
      const next = workspaces[0];
      setMetaPickerDir(null);
      setMetaPickerKind(null);
      return {
        ...prev,
        workspaces,
        activeWorkspaceId: next.id,
        logDirectories: [...next.logDirectories],
        virtualFolders: (next.virtualFolders ?? []).map((v) => ({
          ...v,
          filePaths: [...v.filePaths],
        })),
      };
    });
  };

  const handleSelectDirectory = async () => {
    if (!window.electronAPI?.showOpenDirectoryDialog) return;
    setIsSelectingDirectory(true);
    try {
      const result = await window.electronAPI.showOpenDirectoryDialog();
      if (result.success && result.directoryPath) {
        const newDir = result.directoryPath as string;
        setLocalSettings((prev) => {
          const dirs = prev.logDirectories ?? [];
          if (dirs.includes(newDir)) return prev;
          return syncActiveWorkspaceDirs({ ...prev, logDirectories: [...dirs, newDir] });
        });
      }
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  const updateDirMeta = (dir: string, patch: Partial<DirectoryMeta>) => {
    setLocalSettings((prev) => {
      const current = prev.directoryMeta?.[dir] ?? {};
      const next: DirectoryMeta = { ...current, ...patch };
      if (!next.label) delete next.label;
      if (!next.icon) delete next.icon;
      if (!next.color) delete next.color;
      const meta = { ...(prev.directoryMeta ?? {}) };
      if (Object.keys(next).length === 0) {
        delete meta[dir];
      } else {
        meta[dir] = next;
      }
      return { ...prev, directoryMeta: meta };
    });
  };

  const toggleMetaPicker = (dir: string, kind: 'icon' | 'color') => {
    if (metaPickerDir === dir && metaPickerKind === kind) {
      setMetaPickerDir(null);
      setMetaPickerKind(null);
    } else {
      setMetaPickerDir(dir);
      setMetaPickerKind(kind);
    }
  };

  const enabledFormats = localSettings.enabledFormats ?? FORMAT_GROUPS.map((g) => g.key);

  const toggleFormat = (key: string) => {
    const next = enabledFormats.includes(key)
      ? enabledFormats.filter((f) => f !== key)
      : [...enabledFormats, key];
    setLocalSettings({ ...localSettings, enabledFormats: next });
  };

  const editorOrder = localSettings.editorOrder ?? ['vscode', 'notepadplusplus', 'notepad'];

  const updateHotkey = (id: HotkeyId, binding: HotkeyBinding) => {
    setLocalSettings({
      ...localSettings,
      hotkeys: { ...localSettings.hotkeys, [id]: binding },
    });
  };

  const resetHotkey = (id: HotkeyId) => {
    updateHotkey(id, DEFAULT_HOTKEYS[id]);
  };

  const renderHotkeyGroup = (title: string, ids: HotkeyId[]) => (
    <div className="hotkey-group">
      <h4>{title}</h4>
      <div className="hotkey-list">
        {ids.map((id) => (
          <div key={id} className="hotkey-item">
            <span className="hotkey-label">{t(HOTKEY_LABEL_KEYS[id])}</span>
            <HotkeyCapture
              binding={localSettings.hotkeys[id]}
              onChange={(binding) => updateHotkey(id, binding)}
              onReset={() => resetHotkey(id)}
              pressLabel={t('settings.hotkeyPress')}
              resetLabel={t('settings.hotkeyReset')}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: t('settings.tabGeneral') },
    { id: 'source',  label: t('settings.tabSource')  },
    { id: 'schema',  label: t('settings.tabSchema')  },
    { id: 'tools',   label: t('settings.tabTools')   },
  ];

  return (
    <div className="settings-overlay" onClick={handleCancel}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>

        {/* â”€â”€ Header â”€â”€ */}
        <div className="settings-header">
          <h2>{t('settings.title')}</h2>
          <button className="settings-close" onClick={handleCancel}>✕</button>
        </div>

        {/* â”€â”€ Body: nav + content â”€â”€ */}
        <div className="settings-body">
          <nav className="settings-nav">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="settings-content">

            {/* â•â•â•â•â•â•â•â• ALLGEMEIN â•â•â•â•â•â•â•â• */}
            {activeTab === 'general' && (
              <div className="settings-tab-content">
                <section className="settings-section">
                  <h3>{t('settings.display')}</h3>
                  <div className="settings-input-group">
                    <label>{t('settings.theme')}</label>
                    <select
                      className="settings-input"
                      value={localSettings.theme}
                      onChange={(e) => setLocalSettings({ ...localSettings, theme: e.target.value as 'dark' | 'light' })}
                    >
                      <option value="dark">{t('settings.themeDark')}</option>
                      <option value="light">{t('settings.themeLight')}</option>
                    </select>
                  </div>
                  <div className="settings-input-group">
                    <label>{t('settings.language')}</label>
                    <select
                      className="settings-input"
                      value={localSettings.language}
                      onChange={(e) => {
                        const lang = e.target.value as Language;
                        setLocalSettings({ ...localSettings, language: lang });
                        setLanguage(lang);
                      }}
                    >
                      {(Object.entries(LANGUAGE_LABELS) as [Language, string][]).map(([code, label]) => (
                        <option key={code} value={code}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="settings-input-group">
                    <label>{t('settings.fontSize')}</label>
                    <input
                      type="number"
                      className="settings-input settings-input-narrow"
                      value={localSettings.fontSize}
                      onChange={(e) => setLocalSettings({ ...localSettings, fontSize: parseInt(e.target.value) || 12 })}
                      min="8" max="24"
                    />
                  </div>
                </section>

                <section className="settings-section">
                  <h3>{t('settings.autoUpdate')}</h3>
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={localSettings.autoRefresh}
                      onChange={(e) => setLocalSettings({ ...localSettings, autoRefresh: e.target.checked })}
                    />
                    {t('settings.autoRefresh')}
                  </label>
                  {localSettings.autoRefresh && (
                    <div className="settings-input-group" style={{ marginTop: 12 }}>
                      <label>{t('settings.refreshInterval')}</label>
                      <input
                        type="number"
                        className="settings-input settings-input-narrow"
                        value={localSettings.refreshInterval}
                        onChange={(e) => setLocalSettings({ ...localSettings, refreshInterval: parseInt(e.target.value) || 1000 })}
                        min="100" step="100"
                      />
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* â•â•â•â•â•â•â•â• LOG-QUELLE â•â•â•â•â•â•â•â• */}
            {activeTab === 'source' && (
              <div className="settings-tab-content settings-source-layout">

                {/* Left column */}
                <div className="settings-source-left">
                  <section className="settings-section">
                    <h3>{t('settings.workspaces')}</h3>
                    <div className="settings-workspace-toolbar">
                      <select
                        className="settings-input settings-workspace-select"
                        value={localSettings.activeWorkspaceId}
                        onChange={(e) => handleSelectWorkspace(e.target.value)}
                        aria-label={t('settings.activeWorkspace')}
                      >
                        {(localSettings.workspaces ?? []).map((ws) => (
                          <option key={ws.id} value={ws.id}>
                            {ws.name} ({ws.logDirectories.length})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="settings-button settings-workspace-btn"
                        onClick={handleCreateWorkspace}
                      >
                        {t('settings.newWorkspace')}
                      </button>
                      <button
                        type="button"
                        className="settings-button settings-workspace-btn danger"
                        onClick={handleDeleteWorkspace}
                        disabled={(localSettings.workspaces ?? []).length <= 1}
                        title={t('settings.deleteWorkspace')}
                      >
                        {t('settings.deleteWorkspace')}
                      </button>
                    </div>
                    <div className="settings-input-group" style={{ marginTop: 10 }}>
                      <label>{t('settings.workspaceName')}</label>
                      <input
                        className="settings-input"
                        value={activeWorkspace?.name ?? ''}
                        onChange={(e) => handleWorkspaceNameChange(e.target.value)}
                        placeholder={t('settings.workspaceName')}
                      />
                    </div>
                  </section>

                  <section className="settings-section">
                    <h3>{t('settings.logDirectories')}</h3>
                    <p className="settings-hint">{t('settings.workspaceFoldersHint')}</p>
                    <div className="settings-dir-list">
                      {(localSettings.logDirectories ?? []).length === 0 ? (
                        <div className="settings-dir-empty">{t('settings.noDirectories')}</div>
                      ) : (
                        (localSettings.logDirectories ?? []).map((dir) => {
                          const basename = dir.split(/[\\/]/).filter(Boolean).pop() || dir;
                          const meta = localSettings.directoryMeta?.[dir] ?? {};
                          const label = meta.label ?? '';
                          const colorHex = getDirectoryColor(meta.color);
                          const iconDef = getDirectoryIcon(meta.icon);
                          const showIconPicker = metaPickerDir === dir && metaPickerKind === 'icon';
                          const showColorPicker = metaPickerDir === dir && metaPickerKind === 'color';
                          return (
                          <div key={dir} className="settings-dir-item-wrap">
                          <div className="settings-dir-item">
                            <button
                              type="button"
                              className="settings-dir-color-btn"
                              title={t('settings.directoryColor')}
                              onClick={() => toggleMetaPicker(dir, 'color')}
                            >
                              <span
                                className="settings-dir-color-dot"
                                style={colorHex ? { backgroundColor: colorHex } : undefined}
                              />
                            </button>
                            <button
                              type="button"
                              className="settings-dir-icon-btn"
                              title={t('settings.directoryIcon')}
                              style={colorHex ? { color: colorHex } : undefined}
                              onClick={() => toggleMetaPicker(dir, 'icon')}
                            >
                              {iconDef ? (
                                <FontAwesomeIcon icon={iconDef} />
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                  <path d="M1 4a1 1 0 011-1h4.586a1 1 0 01.707.293L8.707 4.707A1 1 0 009.414 5H14a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V4z" fill="currentColor"/>
                                </svg>
                              )}
                            </button>
                            <div className="settings-dir-info">
                              <span className="settings-dir-path" title={dir}>{dir}</span>
                              <input
                                className="settings-dir-label-input"
                                placeholder={basename}
                                value={label}
                                onChange={(e) => updateDirMeta(dir, { label: e.target.value || undefined })}
                              />
                            </div>
                            <button
                              className="settings-dir-remove"
                              title={t('settings.removeDirectory')}
                              onClick={() => setLocalSettings((prev) => {
                                const nextMeta = { ...(prev.directoryMeta ?? {}) };
                                delete nextMeta[dir];
                                return syncActiveWorkspaceDirs({
                                  ...prev,
                                  logDirectories: prev.logDirectories.filter((d) => d !== dir),
                                  directoryMeta: nextMeta,
                                });
                              })}
                            >×</button>
                          </div>
                          {showIconPicker && (
                            <div className="settings-dir-picker">
                              <DirectoryIconPicker
                                value={meta.icon}
                                clearLabel={t('sidebar.clearIcon')}
                                searchPlaceholder={t('sidebar.searchIcons')}
                                onChange={(iconId) => updateDirMeta(dir, { icon: iconId })}
                              />
                            </div>
                          )}
                          {showColorPicker && (
                            <div className="settings-dir-picker">
                              <DirectoryColorPicker
                                value={meta.color}
                                clearLabel={t('sidebar.clearColor')}
                                onChange={(colorId) => updateDirMeta(dir, { color: colorId })}
                              />
                            </div>
                          )}
                          </div>
                          );
                        })
                      )}
                    </div>
                    <button
                      type="button"
                      className="settings-button settings-directory-button"
                      onClick={handleSelectDirectory}
                      disabled={isSelectingDirectory}
                      style={{ marginTop: 8 }}
                    >
                      {isSelectingDirectory ? t('settings.selectingFolder') : t('settings.addDirectory')}
                    </button>

                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label className="settings-checkbox">
                        <input
                          type="checkbox"
                          checked={localSettings.includeSubdirectories ?? false}
                          onChange={(e) => setLocalSettings({ ...localSettings, includeSubdirectories: e.target.checked })}
                        />
                        {t('settings.includeSubdirectories')}
                      </label>
                      <label className="settings-checkbox">
                        <input
                          type="checkbox"
                          checked={localSettings.autoRefresh}
                          onChange={(e) => setLocalSettings({ ...localSettings, autoRefresh: e.target.checked })}
                        />
                        {t('settings.autoLoadNewFiles')}
                      </label>
                    </div>
                  </section>

                  <section className="settings-section">
                    <h3>{t('settings.virtualFolders')}</h3>
                    <p className="settings-hint">{t('settings.virtualFoldersHint')}</p>
                    <div className="settings-dir-list">
                      {(localSettings.virtualFolders ?? []).length === 0 ? (
                        <div className="settings-dir-empty">{t('settings.noVirtualFolders')}</div>
                      ) : (
                        (localSettings.virtualFolders ?? []).map((folder) => {
                          const colorHex = getDirectoryColor(folder.color);
                          const iconDef = getDirectoryIcon(folder.icon) ?? getDirectoryIcon('bookmark');
                          const showIconPicker = metaPickerDir === folder.id && metaPickerKind === 'icon';
                          const showColorPicker = metaPickerDir === folder.id && metaPickerKind === 'color';
                          const patchVirtual = (patch: Partial<typeof folder>) => {
                            setLocalSettings((prev) =>
                              syncActiveWorkspaceDirs({
                                ...prev,
                                virtualFolders: (prev.virtualFolders ?? []).map((f) => {
                                  if (f.id !== folder.id) return f;
                                  const next = { ...f, ...patch };
                                  if ('icon' in patch && !patch.icon) delete next.icon;
                                  if ('color' in patch && !patch.color) delete next.color;
                                  return next;
                                }),
                              })
                            );
                          };
                          return (
                          <div key={folder.id} className="settings-virtual-item">
                            <div className="settings-virtual-header">
                              <button
                                type="button"
                                className="settings-dir-color-btn"
                                title={t('settings.directoryColor')}
                                onClick={() => toggleMetaPicker(folder.id, 'color')}
                              >
                                <span
                                  className="settings-dir-color-dot"
                                  style={colorHex ? { backgroundColor: colorHex } : undefined}
                                />
                              </button>
                              <button
                                type="button"
                                className="settings-dir-icon-btn"
                                title={t('settings.directoryIcon')}
                                style={colorHex ? { color: colorHex } : undefined}
                                onClick={() => toggleMetaPicker(folder.id, 'icon')}
                              >
                                {iconDef ? <FontAwesomeIcon icon={iconDef} /> : '★'}
                              </button>
                              <input
                                className="settings-dir-label-input"
                                value={folder.name}
                                onChange={(e) =>
                                  setLocalSettings((prev) =>
                                    syncActiveWorkspaceDirs({
                                      ...prev,
                                      virtualFolders: (prev.virtualFolders ?? []).map((f) =>
                                        f.id === folder.id ? { ...f, name: e.target.value } : f
                                      ),
                                    })
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="settings-button settings-workspace-btn"
                                onClick={async () => {
                                  const result = await window.electronAPI?.showOpenFilesDialog?.();
                                  if (!result?.success || !result.filePaths?.length) return;
                                  setLocalSettings((prev) =>
                                    syncActiveWorkspaceDirs({
                                      ...prev,
                                      virtualFolders: (prev.virtualFolders ?? []).map((f) => {
                                        if (f.id !== folder.id) return f;
                                        const existing = new Set(
                                          f.filePaths.map((p) => p.replace(/\\/g, '/').toLowerCase())
                                        );
                                        const added = result.filePaths!.filter(
                                          (p) => !existing.has(p.replace(/\\/g, '/').toLowerCase())
                                        );
                                        return { ...f, filePaths: [...f.filePaths, ...added] };
                                      }),
                                    })
                                  );
                                }}
                              >
                                {t('virtualFolder.addFiles')}
                              </button>
                              <button
                                type="button"
                                className="settings-dir-remove"
                                title={t('virtualFolder.delete')}
                                onClick={() =>
                                  setLocalSettings((prev) =>
                                    syncActiveWorkspaceDirs({
                                      ...prev,
                                      virtualFolders: (prev.virtualFolders ?? []).filter(
                                        (f) => f.id !== folder.id
                                      ),
                                    })
                                  )
                                }
                              >
                                ×
                              </button>
                            </div>
                            {showIconPicker && (
                              <DirectoryIconPicker
                                value={folder.icon}
                                clearLabel={t('sidebar.clearIcon')}
                                searchPlaceholder={t('sidebar.searchIcons')}
                                onChange={(iconId) => patchVirtual({ icon: iconId })}
                              />
                            )}
                            {showColorPicker && (
                              <DirectoryColorPicker
                                value={folder.color}
                                clearLabel={t('sidebar.clearColor')}
                                onChange={(colorId) => patchVirtual({ color: colorId })}
                              />
                            )}
                            <ul className="settings-virtual-files">
                              {folder.filePaths.length === 0 ? (
                                <li className="settings-dir-empty">{t('virtualFolder.empty')}</li>
                              ) : (
                                folder.filePaths.map((path) => (
                                  <li key={path} className="settings-virtual-file">
                                    <span title={path}>{fileBasename(path)}</span>
                                    <button
                                      type="button"
                                      className="settings-dir-remove"
                                      title={t('virtualFolder.removeFile')}
                                      onClick={() =>
                                        setLocalSettings((prev) =>
                                          syncActiveWorkspaceDirs({
                                            ...prev,
                                            virtualFolders: (prev.virtualFolders ?? []).map((f) =>
                                              f.id !== folder.id
                                                ? f
                                                : {
                                                    ...f,
                                                    filePaths: f.filePaths.filter((p) => p !== path),
                                                  }
                                            ),
                                          })
                                        )
                                      }
                                    >
                                      ×
                                    </button>
                                  </li>
                                ))
                              )}
                            </ul>
                          </div>
                          );
                        })
                      )}
                    </div>
                    <button
                      type="button"
                      className="settings-button settings-directory-button"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        const folder = createVirtualFolder(
                          t('virtualFolder.defaultName', {
                            n: (localSettings.virtualFolders?.length ?? 0) + 1,
                          })
                        );
                        setLocalSettings((prev) =>
                          syncActiveWorkspaceDirs({
                            ...prev,
                            virtualFolders: [...(prev.virtualFolders ?? []), folder],
                          })
                        );
                      }}
                    >
                      {t('virtualFolder.create')}
                    </button>
                  </section>

                  <section className="settings-section">
                    <h3>{t('settings.enabledFormats')}</h3>
                    <div className="settings-format-list">
                      {FORMAT_GROUPS.map((group) => (
                        <label key={group.key} className="settings-checkbox settings-format-item">
                          <input
                            type="checkbox"
                            checked={enabledFormats.includes(group.key)}
                            onChange={() => toggleFormat(group.key)}
                          />
                          {t(group.labelKey)}
                        </label>
                      ))}
                    </div>
                  </section>
                </div>

                {/* Right column: Schema-Erkennung */}
                <div className="settings-source-right">
                  <section className="settings-section">
                    <h3>{t('settings.schemaDetection')}</h3>
                    <label className="settings-checkbox" style={{ marginBottom: 12 }}>
                      <input
                        type="checkbox"
                        checked={localSettings.autoDetect ?? true}
                        onChange={(e) => setLocalSettings({ ...localSettings, autoDetect: e.target.checked })}
                      />
                      {t('settings.autoDetect')}
                    </label>
                    {localSettings.autoDetect ? (
                      <div className="settings-detection-info">
                        <p className="settings-detection-hint">{t('settings.autoDetectEnabled')}</p>
                        <div className="settings-detection-formats">
                          {FORMAT_GROUPS.filter((g) => enabledFormats.includes(g.key)).map((g) => (
                            <span key={g.key} className="settings-detection-tag">{t(g.labelKey)}</span>
                          ))}
                          {FORMAT_GROUPS.filter((g) => enabledFormats.includes(g.key)).length === 0 && (
                            <span className="settings-detection-none">{t('settings.noFormatsEnabled')}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="settings-detection-hint settings-detection-hint-off">
                        {t('settings.autoDetectDisabled')}
                      </p>
                    )}
                  </section>
                </div>
              </div>
            )}

            {/* â•â•â•â•â•â•â•â• PARSING & SCHEMA â•â•â•â•â•â•â•â• */}
            {activeTab === 'schema' && (
              <div className="settings-tab-content">
                <section className="settings-section">
                  <h3>{t('settings.logSchema')}</h3>
                  <p className="settings-help-text">{t('settings.logSchemaHelp')}</p>
                  <div className="settings-input-group">
                    <label>{t('settings.regexPattern')}</label>
                    <textarea
                      className={`settings-textarea ${patternError ? 'settings-input-error' : ''}`}
                      value={localSettings.logSchema.pattern}
                      onChange={(e) => handleSchemaChange('pattern', e.target.value)}
                      rows={4}
                      placeholder={t('settings.regexPatternPlaceholder')}
                    />
                    {patternError && (
                      <div className="settings-error-message">
                        {t('settings.regexError', { error: patternError ?? '' })}
                      </div>
                    )}
                    <div className="settings-help-text-small">
                      {t('settings.regexExample')} <code>{REGEX_EXAMPLE}</code>
                      <br />
                      {t('settings.regexExpects')}
                    </div>
                  </div>
                  <div className="settings-input-group">
                    <label>{t('settings.timestampFormat')}</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={localSettings.logSchema.timestampFormat}
                      onChange={(e) => handleSchemaChange('timestampFormat', e.target.value)}
                      placeholder="YYYY-MM-DD HH:mm:ss.SSS"
                    />
                  </div>
                  <div className="settings-fields">
                    <h4>{t('settings.regexGroups')}</h4>
                    <div className="settings-fields-grid">
                      <div className="settings-input-group">
                        <label>{t('settings.timestampGroup')}</label>
                        <input type="number" className="settings-input settings-input-narrow"
                          value={localSettings.logSchema.fields.timestamp}
                          onChange={(e) => handleFieldChange('timestamp', parseInt(e.target.value) || 1)} min="1" />
                      </div>
                      <div className="settings-input-group">
                        <label>{t('settings.levelGroup')}</label>
                        <input type="number" className="settings-input settings-input-narrow"
                          value={localSettings.logSchema.fields.level}
                          onChange={(e) => handleFieldChange('level', parseInt(e.target.value) || 2)} min="1" />
                      </div>
                      <div className="settings-input-group">
                        <label>{t('settings.namespaceGroup')}</label>
                        <input type="number" className="settings-input settings-input-narrow"
                          value={localSettings.logSchema.fields.namespace}
                          onChange={(e) => handleFieldChange('namespace', parseInt(e.target.value) || 3)} min="1" />
                      </div>
                      <div className="settings-input-group">
                        <label>{t('settings.messageGroup')}</label>
                        <input type="number" className="settings-input settings-input-narrow"
                          value={localSettings.logSchema.fields.message}
                          onChange={(e) => handleFieldChange('message', parseInt(e.target.value) || 4)} min="1" />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* â•â•â•â•â•â•â•â• TOOLS & EDITOREN â•â•â•â•â•â•â•â• */}
            {activeTab === 'tools' && (
              <div className="settings-tab-content">
                <section className="settings-section">
                  <h3>{t('settings.editorOrder')}</h3>
                  <p className="settings-help-text">{t('settings.editorOrderHelp')}</p>
                  <div className="editor-order-list">
                    {editorOrder.map((editorId, index) => (
                      <div key={editorId} className="editor-order-item">
                        <span className="editor-order-index">{index + 1}</span>
                        <span className="editor-order-label">{EDITOR_LABELS[editorId as EditorId]}</span>
                        <div className="editor-order-buttons">
                          <button
                            className="editor-order-btn"
                            disabled={index === 0}
                            onClick={() => {
                              const o = [...editorOrder];
                              [o[index - 1], o[index]] = [o[index], o[index - 1]];
                              setLocalSettings({ ...localSettings, editorOrder: o });
                            }}
                            title={t('settings.moveUp')}
                          >▲</button>
                          <button
                            className="editor-order-btn"
                            disabled={index === editorOrder.length - 1}
                            onClick={() => {
                              const o = [...editorOrder];
                              [o[index + 1], o[index]] = [o[index], o[index + 1]];
                              setLocalSettings({ ...localSettings, editorOrder: o });
                            }}
                            title={t('settings.moveDown')}
                          >▼</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="settings-section">
                  <h3>{t('settings.hotkeys')}</h3>
                  <p className="settings-help-text">{t('settings.hotkeysHelp')}</p>
                  {renderHotkeyGroup(t('settings.hotkeyGroupEditor'), EDITOR_HOTKEYS)}
                  {renderHotkeyGroup(t('settings.hotkeyGroupSearch'), SEARCH_HOTKEYS)}
                </section>

                <section className="settings-section">
                  <h3>{t('settings.aiTitle')}</h3>
                  <p className="settings-help-text">{t('settings.aiHelp')}</p>
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={!!localSettings.aiEnabled}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, aiEnabled: e.target.checked })
                      }
                    />
                    <span>{t('settings.aiEnabled')}</span>
                  </label>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label>{t('settings.aiModel')}</label>
                    <select
                      value={localSettings.aiModel || 'llama3.2:3b'}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, aiModel: e.target.value })
                      }
                    >
                      <option value="llama3.2:3b">llama3.2:3b (~2 GB)</option>
                      <option value="qwen2.5:7b">qwen2.5:7b (~4–5 GB)</option>
                      <option value="llama3.1:8b">llama3.1:8b (~4–5 GB)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label>{t('settings.aiBaseUrl')}</label>
                    <input
                      type="text"
                      value={localSettings.aiBaseUrl || 'http://127.0.0.1:11434'}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, aiBaseUrl: e.target.value })
                      }
                    />
                  </div>
                </section>
              </div>
            )}

          </div>{/* end settings-content */}
        </div>{/* end settings-body */}

        {/* â”€â”€ Footer â”€â”€ */}
        <div className="settings-footer">
          <button className="settings-button settings-button-primary" onClick={handleSave}>
            {t('settings.save')}
          </button>
          <button className="settings-button" onClick={handleCancel}>
            {t('settings.cancel')}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsPanel;
