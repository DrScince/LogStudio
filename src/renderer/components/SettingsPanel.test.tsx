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
    autoRefresh: true,
    refreshInterval: 1000,
    fontSize: 12,
    theme: 'dark',
  };

  const defaultProps = {
    settings: defaultSettings,
    onClose: vi.fn(),
    onSettingsChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render settings panel', () => {
    render(<SettingsPanel {...defaultProps} />);
    
    expect(screen.getByText(/Settings/i)).toBeInTheDocument();
  });

  it('should display current settings values', () => {
    render(<SettingsPanel {...defaultProps} />);
    
    expect(screen.getByDisplayValue('/test/logs')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12')).toBeInTheDocument();
  });

  it('should update log directory when input changes', async () => {
    render(<SettingsPanel {...defaultProps} />);
    
    const directoryInput = screen.getByPlaceholderText(/Path to log directory/i);
    fireEvent.change(directoryInput, { target: { value: '/new/path' } });
    
    expect(directoryInput).toHaveValue('/new/path');
  });

  it('should update font size when input changes', async () => {
    render(<SettingsPanel {...defaultProps} />);
    
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
    
    const checkbox = screen.getByLabelText(/Auto-refresh/i);
    expect(checkbox).toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('should call onSave when save button is clicked', async () => {
    const onSave = vi.fn();
    render(<SettingsPanel {...defaultProps} onSettingsChange={onSave} />);
    
    const saveButton = screen.getByText(/Save/i);
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
    
    const patternInput = screen.getByPlaceholderText(/z\.B\.:/i);
    fireEvent.change(patternInput, { target: { value: 'new-pattern' } });
    
    expect(patternInput).toHaveValue('new-pattern');
  });
});
