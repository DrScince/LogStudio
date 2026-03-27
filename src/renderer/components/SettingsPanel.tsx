import React, { useState } from 'react';
import { AppSettings, LogSchema, EditorId } from '../utils/settings';
import { useTranslation, LANGUAGE_LABELS, Language } from '../i18n';
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

  const handleSave = () => { onSettingsChange(localSettings); onClose(); };
  const handleCancel = () => { setLocalSettings(settings); onClose(); };

  const handleSelectDirectory = async () => {
    if (!window.electronAPI?.showOpenDirectoryDialog) return;
    setIsSelectingDirectory(true);
    try {
      const result = await window.electronAPI.showOpenDirectoryDialog();
      if (result.success && result.directoryPath) {
        setLocalSettings((prev) => ({ ...prev, logDirectory: result.directoryPath as string }));
      }
    } finally {
      setIsSelectingDirectory(false);
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
                    <h3>{t('settings.logDirectory')}</h3>
                    <div className="settings-directory-row">
                      <input
                        type="text"
                        className="settings-input"
                        value={localSettings.logDirectory}
                        onChange={(e) => setLocalSettings({ ...localSettings, logDirectory: e.target.value })}
                        placeholder={t('settings.logDirectoryPlaceholder')}
                      />
                      <button
                        type="button"
                        className="settings-button settings-directory-button"
                        onClick={handleSelectDirectory}
                        disabled={isSelectingDirectory}
                      >
                        {isSelectingDirectory ? t('settings.selectingFolder') : t('settings.selectFolder')}
                      </button>
                    </div>

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
