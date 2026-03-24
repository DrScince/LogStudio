import React, { useState } from 'react';
import { AppSettings, LogSchema, EditorId } from '../utils/settings';
import { useTranslation, LANGUAGE_LABELS, Language } from '../i18n';
import './SettingsPanel.css';

const EDITOR_LABELS: Record<EditorId, string> = {
  vscode: 'Visual Studio Code',
  notepadplusplus: 'Notepad++',
  notepad: 'Notepad (Windows)',
};

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, onClose }) => {
  const { t, setLanguage } = useTranslation();
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
    const newSchema = {
      ...localSettings.logSchema,
      [field]: value,
    };
    
    // Validate pattern if it's being changed
    if (field === 'pattern') {
      validatePattern(value);
    }
    
    setLocalSettings({
      ...localSettings,
      logSchema: newSchema,
    });
  };

  const handleFieldChange = (field: keyof LogSchema['fields'], value: number) => {
    setLocalSettings({
      ...localSettings,
      logSchema: {
        ...localSettings.logSchema,
        fields: {
          ...localSettings.logSchema.fields,
          [field]: value,
        },
      },
    });
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    onClose();
  };

  const handleSelectDirectory = async () => {
    if (!window.electronAPI?.showOpenDirectoryDialog) {
      return;
    }

    setIsSelectingDirectory(true);
    try {
      const result = await window.electronAPI.showOpenDirectoryDialog();
      if (result.success && result.directoryPath) {
        setLocalSettings((prev) => ({
          ...prev,
          logDirectory: result.directoryPath as string,
        }));
      }
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  return (
    <div className="settings-overlay" onClick={handleCancel}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t('settings.title')}</h2>
          <button className="settings-close" onClick={handleCancel}>
            ✕
          </button>
        </div>
        <div className="settings-content">
          <div className="settings-section">
            <h3>{t('settings.logDirectory')}</h3>
            <div className="settings-directory-row">
              <input
                type="text"
                className="settings-input"
                value={localSettings.logDirectory}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, logDirectory: e.target.value })
                }
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
          </div>

          <div className="settings-section">
            <h3>{t('settings.autoUpdate')}</h3>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={localSettings.autoRefresh}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, autoRefresh: e.target.checked })
                }
              />
              {t('settings.autoRefresh')}
            </label>
            <div className="settings-input-group">
              <label>{t('settings.refreshInterval')}</label>
              <input
                type="number"
                className="settings-input"
                value={localSettings.refreshInterval}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    refreshInterval: parseInt(e.target.value) || 1000,
                  })
                }
                min="100"
                step="100"
              />
            </div>
          </div>

          <div className="settings-section">
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
              <div className="settings-input-group">
                <label>{t('settings.timestampGroup')}</label>
                <input type="number" className="settings-input" value={localSettings.logSchema.fields.timestamp}
                  onChange={(e) => handleFieldChange('timestamp', parseInt(e.target.value) || 1)} min="1" />
              </div>
              <div className="settings-input-group">
                <label>{t('settings.levelGroup')}</label>
                <input type="number" className="settings-input" value={localSettings.logSchema.fields.level}
                  onChange={(e) => handleFieldChange('level', parseInt(e.target.value) || 2)} min="1" />
              </div>
              <div className="settings-input-group">
                <label>{t('settings.namespaceGroup')}</label>
                <input type="number" className="settings-input" value={localSettings.logSchema.fields.namespace}
                  onChange={(e) => handleFieldChange('namespace', parseInt(e.target.value) || 3)} min="1" />
              </div>
              <div className="settings-input-group">
                <label>{t('settings.messageGroup')}</label>
                <input type="number" className="settings-input" value={localSettings.logSchema.fields.message}
                  onChange={(e) => handleFieldChange('message', parseInt(e.target.value) || 4)} min="1" />
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>{t('settings.display')}</h3>
            <div className="settings-input-group">
              <label>{t('settings.fontSize')}</label>
              <input
                type="number"
                className="settings-input"
                value={localSettings.fontSize}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    fontSize: parseInt(e.target.value) || 12,
                  })
                }
                min="8"
                max="24"
              />
            </div>
            <div className="settings-input-group">
              <label>{t('settings.theme')}</label>
              <select
                className="settings-input"
                value={localSettings.theme}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, theme: e.target.value as 'dark' | 'light' })
                }
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
          </div>
        </div>
        <div className="settings-section">
          <h3 className="settings-section-title">{t('settings.editorOrder')}</h3>
          <p className="settings-help-text">{t('settings.editorOrderHelp')}</p>
          <div className="editor-order-list">
            {(localSettings.editorOrder ?? ['vscode', 'notepadplusplus', 'notepad']).map((editorId, index) => {
              const order = localSettings.editorOrder ?? ['vscode', 'notepadplusplus', 'notepad'];
              return (
                <div key={editorId} className="editor-order-item">
                  <span className="editor-order-index">{index + 1}</span>
                  <span className="editor-order-label">{EDITOR_LABELS[editorId as EditorId]}</span>
                  <div className="editor-order-buttons">
                    <button
                      className="editor-order-btn"
                      disabled={index === 0}
                      onClick={() => {
                        const newOrder = [...order];
                        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                        setLocalSettings({ ...localSettings, editorOrder: newOrder });
                      }}
                      title={t('settings.moveUp')}
                    >▲</button>
                    <button
                      className="editor-order-btn"
                      disabled={index === order.length - 1}
                      onClick={() => {
                        const newOrder = [...order];
                        [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
                        setLocalSettings({ ...localSettings, editorOrder: newOrder });
                      }}
                      title={t('settings.moveDown')}
                    >▼</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
