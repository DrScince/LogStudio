import React, { useState } from 'react';
import { AppSettings, LogSchema } from '../utils/settings';
import './SettingsPanel.css';

interface SettingsPanelProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onSettingsChange, onClose }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  const handleSchemaChange = (field: keyof LogSchema, value: any) => {
    setLocalSettings({
      ...localSettings,
      logSchema: {
        ...localSettings.logSchema,
        [field]: value,
      },
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

  return (
    <div className="settings-overlay" onClick={handleCancel}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Einstellungen</h2>
          <button className="settings-close" onClick={handleCancel}>
            ✕
          </button>
        </div>
        <div className="settings-content">
          <div className="settings-section">
            <h3>Log-Verzeichnis</h3>
            <input
              type="text"
              className="settings-input"
              value={localSettings.logDirectory}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, logDirectory: e.target.value })
              }
              placeholder="Pfad zum Log-Verzeichnis"
            />
          </div>

          <div className="settings-section">
            <h3>Auto-Update</h3>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={localSettings.autoRefresh}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, autoRefresh: e.target.checked })
                }
              />
              Automatisch aktualisieren
            </label>
            <div className="settings-input-group">
              <label>Aktualisierungsintervall (ms):</label>
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
            <h3>Log-Schema</h3>
            <div className="settings-input-group">
              <label>Regex-Pattern:</label>
              <textarea
                className="settings-textarea"
                value={localSettings.logSchema.pattern}
                onChange={(e) => handleSchemaChange('pattern', e.target.value)}
                rows={3}
                placeholder="Regex-Pattern für Log-Zeilen"
              />
            </div>
            <div className="settings-input-group">
              <label>Separator:</label>
              <input
                type="text"
                className="settings-input"
                value={localSettings.logSchema.separator}
                onChange={(e) => handleSchemaChange('separator', e.target.value)}
                placeholder=" | "
              />
            </div>
            <div className="settings-input-group">
              <label>Timestamp-Format:</label>
              <input
                type="text"
                className="settings-input"
                value={localSettings.logSchema.timestampFormat}
                onChange={(e) => handleSchemaChange('timestampFormat', e.target.value)}
                placeholder="YYYY-MM-DD HH:mm:ss.SSS"
              />
            </div>
            <div className="settings-fields">
              <h4>Regex-Gruppen (1-basiert):</h4>
              <div className="settings-input-group">
                <label>Timestamp-Gruppe:</label>
                <input
                  type="number"
                  className="settings-input"
                  value={localSettings.logSchema.fields.timestamp}
                  onChange={(e) =>
                    handleFieldChange('timestamp', parseInt(e.target.value) || 1)
                  }
                  min="1"
                />
              </div>
              <div className="settings-input-group">
                <label>Level-Gruppe:</label>
                <input
                  type="number"
                  className="settings-input"
                  value={localSettings.logSchema.fields.level}
                  onChange={(e) =>
                    handleFieldChange('level', parseInt(e.target.value) || 2)
                  }
                  min="1"
                />
              </div>
              <div className="settings-input-group">
                <label>Namespace-Gruppe:</label>
                <input
                  type="number"
                  className="settings-input"
                  value={localSettings.logSchema.fields.namespace}
                  onChange={(e) =>
                    handleFieldChange('namespace', parseInt(e.target.value) || 3)
                  }
                  min="1"
                />
              </div>
              <div className="settings-input-group">
                <label>Message-Gruppe:</label>
                <input
                  type="number"
                  className="settings-input"
                  value={localSettings.logSchema.fields.message}
                  onChange={(e) =>
                    handleFieldChange('message', parseInt(e.target.value) || 4)
                  }
                  min="1"
                />
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Anzeige</h3>
            <div className="settings-input-group">
              <label>Schriftgröße:</label>
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
              <label>Theme:</label>
              <select
                className="settings-input"
                value={localSettings.theme}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    theme: e.target.value as 'dark' | 'light',
                  })
                }
              >
                <option value="dark">Dunkel</option>
                <option value="light">Hell</option>
              </select>
            </div>
          </div>
        </div>
        <div className="settings-footer">
          <button className="settings-button settings-button-primary" onClick={handleSave}>
            Speichern
          </button>
          <button className="settings-button" onClick={handleCancel}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
