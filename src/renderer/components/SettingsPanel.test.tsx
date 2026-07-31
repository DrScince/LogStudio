import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPanel from './SettingsPanel';
import { AppSettings } from '../utils/settings';

describe('SettingsPanel', () => {
  const defaultSettings: AppSettings = {
    logSchema: {
      pattern: '^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d+) \\| ([A-Z]+) \\| ([^|]+) \\| (.+)$',
      timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
      fields: {
        timestamp: 1,
        level: 2,
        namespace: 3,
        message: 4,
      },
    },
    logDirectory: '/test/logs',
    logDirectories: ['/test/logs'],
    directoryMeta: {},
    workspaces: [{ id: 'default-workspace', name: 'Default', logDirectories: ['/test/logs'], virtualFolders: [] }],
    activeWorkspaceId: 'default-workspace',
    virtualFolders: [],
    autoRefresh: true,
    refreshInterval: 1000,
    fontSize: 12,
    theme: 'dark',
    editorOrder: ['vscode', 'notepadplusplus', 'notepad'],
    language: 'en',
    autoDetect: true,
    enabledFormats: ['pipe', 'log4j', 'json', 'logfmt', 'syslog', 'apache', 'german'],
    includeSubdirectories: false,
    hotkeys: {
      save:           { ctrl: true,  alt: false, shift: false, key: 's' },
      format:         { ctrl: false, alt: false, shift: false, key: 'd', chord: true },
      comment:        { ctrl: false, alt: false, shift: false, key: 'c', chord: true },
      uncomment:      { ctrl: false, alt: false, shift: false, key: 'u', chord: true },
      cutLine:        { ctrl: false, alt: false, shift: true,  key: 'Delete' },
      moveLineUp:     { ctrl: false, alt: true,  shift: false, key: 'ArrowUp' },
      moveLineDown:   { ctrl: false, alt: true,  shift: false, key: 'ArrowDown' },
      openSearch:     { ctrl: true,  alt: false, shift: false, key: 'f' },
      nextMatch:      { ctrl: false, alt: false, shift: false, key: 'F3' },
      prevMatch:      { ctrl: false, alt: false, shift: true,  key: 'F3' },
      showAllMatches: { ctrl: false, alt: true,  shift: false, key: 'Enter' },
    },
  };

  const defaultProps = {
    settings: defaultSettings,
    onClose: vi.fn(),
    onSettingsChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).electronAPI = {
      showOpenDirectoryDialog: vi.fn().mockResolvedValue({
        success: true,
        directoryPath: '/selected/logs',
      }),
    };
  });

  it('should render settings panel', () => {
    render(<SettingsPanel {...defaultProps} />);
    
    expect(screen.getByText(/Settings/i)).toBeInTheDocument();
  });

  it('should display current settings values', () => {
    render(<SettingsPanel {...defaultProps} />);
    
    // Log directory path is displayed as text in the Log Source tab (default active)
    expect(screen.getByText('/test/logs')).toBeInTheDocument();

    // Font size is on the General tab
    fireEvent.click(screen.getByText('General'));
    expect(screen.getByDisplayValue('12')).toBeInTheDocument();
  });

  it('should update directory label when label input changes', async () => {
    const onSettingsChange = vi.fn();
    render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);

    // Each directory has a label input with placeholder = basename
    const labelInput = screen.getByPlaceholderText('logs');
    fireEvent.change(labelInput, { target: { value: 'My Logs' } });

    // Label is stored in local state; commit via Save
    fireEvent.click(screen.getByText('Save'));
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        directoryMeta: { '/test/logs': { label: 'My Logs' } },
      })
    );
  });

  it('should update directory icon via icon picker', async () => {
    const onSettingsChange = vi.fn();
    render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);

    fireEvent.click(screen.getByTitle('Directory icon'));
    fireEvent.click(screen.getByTitle('server'));
    fireEvent.click(screen.getByText('Save'));

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        directoryMeta: { '/test/logs': { icon: 'server' } },
      })
    );
  });

  it('should update directory color via color picker', async () => {
    const onSettingsChange = vi.fn();
    render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);

    fireEvent.click(screen.getByTitle('Directory color'));
    fireEvent.click(screen.getByTitle('Blue'));
    fireEvent.click(screen.getByText('Save'));

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        directoryMeta: { '/test/logs': { color: 'blue' } },
      })
    );
  });

  it('should rename workspace and keep folder config on save', () => {
    const onSettingsChange = vi.fn();
    render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);

    expect(screen.getByLabelText('Active workspace')).toBeInTheDocument();
    const nameInput = screen.getByDisplayValue('Default');
    fireEvent.change(nameInput, { target: { value: 'Production' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaces: [
          expect.objectContaining({
            id: 'default-workspace',
            name: 'Production',
            logDirectories: ['/test/logs'],
          }),
        ],
        logDirectories: ['/test/logs'],
      })
    );
  });

  it('should create a new empty workspace from settings', () => {
    const onSettingsChange = vi.fn();
    render(<SettingsPanel {...defaultProps} onSettingsChange={onSettingsChange} />);

    fireEvent.click(screen.getByRole('button', { name: /^New$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        logDirectories: [],
        workspaces: expect.arrayContaining([
          expect.objectContaining({ name: 'Default', logDirectories: ['/test/logs'] }),
          expect.objectContaining({ logDirectories: [] }),
        ]),
      })
    );
  });

  it('should update font size when input changes', async () => {
    render(<SettingsPanel {...defaultProps} />);

    // Navigate to General tab
    fireEvent.click(screen.getByText('General'));
    
    // Find by role and value
    const fontSizeInputs = screen.getAllByRole('spinbutton');
    const fontSizeInput = fontSizeInputs.find(input => (input as HTMLInputElement).value === '12');
    expect(fontSizeInput).toBeDefined();
    
    if (fontSizeInput) {
      fireEvent.change(fontSizeInput, { target: { value: '16' } });
      expect(fontSizeInput).toHaveValue(16);
    }
  });

  it('should toggle auto refresh checkbox', async () => {
    render(<SettingsPanel {...defaultProps} />);

    // Navigate to General tab
    fireEvent.click(screen.getByText('General'));
    
    const checkbox = screen.getByLabelText(/Auto-refresh/i);
    expect(checkbox).toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('should call onSave when save button is clicked', async () => {
    const onSave = vi.fn();
    render(<SettingsPanel {...defaultProps} onSettingsChange={onSave} />);
    
    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<SettingsPanel {...defaultProps} onClose={onClose} />);
    
    const closeButton = screen.getByText('✕');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should update regex pattern', async () => {
    render(<SettingsPanel {...defaultProps} />);

    // Navigate to Parsing & Schema tab
    fireEvent.click(screen.getByText('Parsing & Schema'));
    
    const patternInput = screen.getByPlaceholderText(/e\.g\.:/i);
    fireEvent.change(patternInput, { target: { value: 'new-pattern' } });
    
    expect(patternInput).toHaveValue('new-pattern');
  });

  it('should pick directory via dialog button', async () => {
    render(<SettingsPanel {...defaultProps} />);

    // Log Source tab is active by default
    const addButton = screen.getByRole('button', { name: /Add directory/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('/selected/logs')).toBeInTheDocument();
    });
  });
});
