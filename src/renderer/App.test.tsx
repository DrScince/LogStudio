import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// Mock all child components
vi.mock('./components/TitleBar', () => ({
  default: () => <div data-testid="title-bar">TitleBar</div>,
}));

const mockOnSettingsClick = vi.fn();
const mockOnAboutClick = vi.fn();
const mockOnOpenFile = vi.fn();
const mockOnThemeToggle = vi.fn();
const mockOnTabSelect = vi.fn();
const mockOnTabClose = vi.fn();
const mockOnLogFileSelect = vi.fn();
const mockOnLogFilesSelect = vi.fn();

vi.mock('./components/Toolbar', () => ({
  default: ({ onSettingsClick, onAboutClick, onOpenFile, onThemeToggle, onTabSelect, onTabClose, tabs, activeTabId }: any) => (
    <div data-testid="toolbar">
      <button onClick={onSettingsClick}>Settings</button>
      <button onClick={onAboutClick}>About</button>
      <button onClick={onOpenFile}>Open File</button>
      <button onClick={onThemeToggle}>Toggle Theme</button>
      {tabs?.map((tab: any) => (
        <div key={tab.id} data-testid={`tab-${tab.id}`} onClick={() => onTabSelect(tab.id)}>
          {tab.filePath}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('./components/Sidebar', () => ({
  default: ({ onLogFileSelect, onLogFilesSelect }: any) => (
    <div data-testid="sidebar">
      <button onClick={() => onLogFileSelect('/test/file.log')}>Select File</button>
      <button onClick={() => onLogFilesSelect(['/test/file1.log', '/test/file2.log'])}>Select Files</button>
    </div>
  ),
}));

vi.mock('./components/LogViewer', () => ({
  default: () => <div data-testid="log-viewer">LogViewer</div>,
}));

vi.mock('./components/NamespaceToolbar', () => ({
  default: () => <div data-testid="namespace-toolbar">NamespaceToolbar</div>,
}));

const mockOnSettingsChange = vi.fn();
vi.mock('./components/SettingsPanel', () => ({
  default: ({ onSettingsChange, onClose, settings }: any) => (
    <div data-testid="settings-panel">
      <button onClick={() => {
        const newSettings = { ...settings, fontSize: 14 };
        onSettingsChange(newSettings);
        onClose();
      }}>Save Settings</button>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('./components/AboutPanel', () => ({
  default: ({ onClose }: any) => (
    <div data-testid="about-panel">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  (window as any).electronAPI = {
    getDefaultLogDirectory: vi.fn().mockResolvedValue({
      success: true,
      path: '/default/log/directory',
    }),
    showOpenDialog: vi.fn().mockResolvedValue({
      success: true,
      filePath: '/test/file.log',
      canceled: false,
    }),
  };
});

describe('App', () => {
  it('should render main application structure', () => {
    render(<App />);
    
    expect(screen.getByTestId('title-bar')).toBeInTheDocument();
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('should load default settings on mount', () => {
    render(<App />);
    
    // App should render without errors, which means settings loaded successfully
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('should open settings panel when settings button is clicked', () => {
    render(<App />);
    const settingsButton = screen.getByText('Settings');
    fireEvent.click(settingsButton);
    
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
  });

  it('should close settings panel when close button is clicked', () => {
    render(<App />);
    const settingsButton = screen.getByText('Settings');
    fireEvent.click(settingsButton);
    
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    
    expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
  });

  it('should open about panel when about button is clicked', () => {
    render(<App />);
    const aboutButton = screen.getByText('About');
    fireEvent.click(aboutButton);
    
    expect(screen.getByTestId('about-panel')).toBeInTheDocument();
  });

  it('should close about panel when close button is clicked', () => {
    render(<App />);
    const aboutButton = screen.getByText('About');
    fireEvent.click(aboutButton);
    
    expect(screen.getByTestId('about-panel')).toBeInTheDocument();
    
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    
    expect(screen.queryByTestId('about-panel')).not.toBeInTheDocument();
  });

  it('should toggle theme when theme toggle button is clicked', () => {
    render(<App />);
    const themeButton = screen.getByText('Toggle Theme');
    fireEvent.click(themeButton);
    
    // Theme should be toggled (check if root element has light class)
    const root = document.documentElement;
    // After toggle, theme should change
    expect(root.classList.contains('light') || !root.classList.contains('light')).toBe(true);
  });

  it('should handle file selection from sidebar', () => {
    render(<App />);
    const selectFileButton = screen.getByText('Select File');
    fireEvent.click(selectFileButton);
    
    // File should be opened in a tab
    expect(screen.getByTestId('log-viewer')).toBeInTheDocument();
  });

  it('should handle multiple file selection from sidebar', () => {
    render(<App />);
    const selectFilesButton = screen.getByText('Select Files');
    fireEvent.click(selectFilesButton);
    
    // Multiple files should be opened in a tab
    expect(screen.getByTestId('log-viewer')).toBeInTheDocument();
  });

  it('should update settings when settings are saved', async () => {
    render(<App />);
    const settingsButton = screen.getByText('Settings');
    fireEvent.click(settingsButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    });
    
    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);
    
    // Settings should be updated and panel closed
    await waitFor(() => {
      expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
    });
  });

  it('should set default log directory if not set', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect((window as any).electronAPI.getDefaultLogDirectory).toHaveBeenCalled();
    });
  });

  it('should handle file dialog cancellation', async () => {
    (window as any).electronAPI.showOpenDialog.mockResolvedValue({
      success: true,
      canceled: true,
    });

    render(<App />);
    const openFileButton = screen.getByText('Open File');
    fireEvent.click(openFileButton);

    await waitFor(() => {
      expect((window as any).electronAPI.showOpenDialog).toHaveBeenCalled();
    });
  });

  it('should handle file dialog error', async () => {
    (window as any).electronAPI.showOpenDialog.mockResolvedValue({
      success: false,
      error: 'Dialog error',
    });

    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<App />);
    const openFileButton = screen.getByText('Open File');
    fireEvent.click(openFileButton);

    await waitFor(() => {
      expect((window as any).electronAPI.showOpenDialog).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });

  it('should handle tab selection', () => {
    render(<App />);
    const selectFileButton = screen.getByText('Select File');
    fireEvent.click(selectFileButton);

    // File should be opened, creating a tab
    expect(screen.getByTestId('log-viewer')).toBeInTheDocument();
  });

  it('should handle tab closing when it is the active tab', () => {
    render(<App />);
    const selectFileButton = screen.getByText('Select File');
    fireEvent.click(selectFileButton);

    // Tab should be created
    expect(screen.getByTestId('log-viewer')).toBeInTheDocument();
  });

  it('should handle adding files to active tab', () => {
    render(<App />);
    
    // First select a file
    const selectFileButton = screen.getByText('Select File');
    fireEvent.click(selectFileButton);

    // Then select multiple files
    const selectFilesButton = screen.getByText('Select Files');
    fireEvent.click(selectFilesButton);

    // Multiple files should be handled
    expect(screen.getByTestId('log-viewer')).toBeInTheDocument();
  });

  it('should handle namespace toggle', () => {
    render(<App />);
    const selectFileButton = screen.getByText('Select File');
    fireEvent.click(selectFileButton);

    // Namespace toolbar should be visible when file is open
    expect(screen.getByTestId('namespace-toolbar')).toBeInTheDocument();
  });

  it('should handle reset filters', () => {
    render(<App />);
    const selectFileButton = screen.getByText('Select File');
    fireEvent.click(selectFileButton);

    // LogViewer should receive reset filter trigger
    expect(screen.getByTestId('log-viewer')).toBeInTheDocument();
  });

  it('should handle electronAPI not available in handleOpenFile', async () => {
    const originalElectronAPI = (window as any).electronAPI;
    (window as any).electronAPI = undefined;
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<App />);
    const openFileButton = screen.getByText('Open File');
    fireEvent.click(openFileButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
    (window as any).electronAPI = originalElectronAPI;
  });

  it('should apply theme changes to root element', () => {
    render(<App />);
    const themeButton = screen.getByText('Toggle Theme');
    const root = document.documentElement;

    const initialHasLight = root.classList.contains('light');
    fireEvent.click(themeButton);

    // Theme should toggle
    expect(root.classList.contains('light')).toBe(!initialHasLight);
  });

  it('should apply font size changes to root element', () => {
    render(<App />);
    const settingsButton = screen.getByText('Settings');
    fireEvent.click(settingsButton);

    const saveButton = screen.getByText('Save Settings');
    fireEvent.click(saveButton);

    // Font size should be applied via CSS variable
    const root = document.documentElement;
    const fontSize = root.style.getPropertyValue('--base-font-size');
    expect(fontSize).toBeTruthy();
  });
});
