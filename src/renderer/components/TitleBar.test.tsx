import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TitleBar from './TitleBar';

const defaultProps = {
  onOpenFile: vi.fn(),
  onSettingsClick: vi.fn(),
  onAboutClick: vi.fn(),
  onThemeToggle: vi.fn(),
  onCheckForUpdates: vi.fn(),
  currentTheme: 'dark' as const,
  checkingForUpdates: false,
  updateAvailable: false,
};

describe('TitleBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).electronAPI = {
      minimizeWindow: vi.fn(),
      maximizeWindow: vi.fn(),
      closeWindow: vi.fn(),
    };
  });

  it('should render title bar with logo and title', () => {
    render(<TitleBar {...defaultProps} />);
    expect(screen.getByText('LogStudio')).toBeInTheDocument();
    expect(screen.getByAltText('LogStudio')).toBeInTheDocument();
  });

  it('should render Open button', () => {
    render(<TitleBar {...defaultProps} />);
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('should call onOpenFile when Open button is clicked', () => {
    render(<TitleBar {...defaultProps} />);
    fireEvent.click(screen.getByText('Open'));
    expect(defaultProps.onOpenFile).toHaveBeenCalled();
  });

  it('should call onSettingsClick when Settings button is clicked', () => {
    render(<TitleBar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Settings'));
    expect(defaultProps.onSettingsClick).toHaveBeenCalled();
  });

  it('should call onAboutClick when About button is clicked', () => {
    render(<TitleBar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('About'));
    expect(defaultProps.onAboutClick).toHaveBeenCalled();
  });

  it('should render check for updates button', () => {
    render(<TitleBar {...defaultProps} />);
    expect(screen.getByTitle('Nach Updates suchen')).toBeInTheDocument();
  });

  it('should call onCheckForUpdates when clicked', () => {
    render(<TitleBar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Nach Updates suchen'));
    expect(defaultProps.onCheckForUpdates).toHaveBeenCalled();
  });

  it('should show checking state when checkingForUpdates is true', () => {
    render(<TitleBar {...defaultProps} checkingForUpdates={true} />);
    expect(screen.getByTitle('Suche nach Updates…')).toBeDisabled();
  });

  it('should hide updates button when updateAvailable is true', () => {
    render(<TitleBar {...defaultProps} updateAvailable={true} />);
    expect(screen.queryByTitle('Nach Updates suchen')).not.toBeInTheDocument();
  });

  it('should render minimize button', () => {
    render(<TitleBar {...defaultProps} />);
    expect(screen.getByTitle('Minimize')).toBeInTheDocument();
  });

  it('should call minimizeWindow when minimize button is clicked', () => {
    render(<TitleBar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Minimize'));
    expect((window as any).electronAPI.minimizeWindow).toHaveBeenCalled();
  });

  it('should call maximizeWindow when maximize button is clicked', () => {
    render(<TitleBar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Maximize'));
    expect((window as any).electronAPI.maximizeWindow).toHaveBeenCalled();
  });

  it('should call closeWindow when close button is clicked', () => {
    render(<TitleBar {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Close'));
    expect((window as any).electronAPI.closeWindow).toHaveBeenCalled();
  });

  it('should not crash when electronAPI is not available', () => {
    (window as any).electronAPI = undefined;
    render(<TitleBar {...defaultProps} />);
    expect(() => fireEvent.click(screen.getByTitle('Minimize'))).not.toThrow();
  });
});
