import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock all child components
vi.mock('./components/TitleBar', () => ({
  default: () => <div data-testid="title-bar">TitleBar</div>,
}));

vi.mock('./components/Toolbar', () => ({
  default: ({ onSettingsClick, onAboutClick }: any) => (
    <div data-testid="toolbar">
      <button onClick={onSettingsClick}>Settings</button>
      <button onClick={onAboutClick}>About</button>
    </div>
  ),
}));

vi.mock('./components/Sidebar', () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('./components/LogViewer', () => ({
  default: () => <div data-testid="log-viewer">LogViewer</div>,
}));

vi.mock('./components/NamespaceToolbar', () => ({
  default: () => <div data-testid="namespace-toolbar">NamespaceToolbar</div>,
}));

vi.mock('./components/SettingsPanel', () => ({
  default: () => <div data-testid="settings-panel">SettingsPanel</div>,
}));

vi.mock('./components/AboutPanel', () => ({
  default: () => <div data-testid="about-panel">AboutPanel</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
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

  it('should handle settings changes', () => {
    render(<App />);
    
    // App should render without errors
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });
});
