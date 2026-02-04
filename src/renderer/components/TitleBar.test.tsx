import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TitleBar from './TitleBar';

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
    render(<TitleBar />);
    expect(screen.getByText('LogStudio')).toBeInTheDocument();
    expect(screen.getByAltText('LogStudio')).toBeInTheDocument();
  });

  it('should render minimize button', () => {
    render(<TitleBar />);
    const minimizeButton = screen.getByTitle('Minimize');
    expect(minimizeButton).toBeInTheDocument();
  });

  it('should render maximize button', () => {
    render(<TitleBar />);
    const maximizeButton = screen.getByTitle('Maximize');
    expect(maximizeButton).toBeInTheDocument();
  });

  it('should render close button', () => {
    render(<TitleBar />);
    const closeButton = screen.getByTitle('Close');
    expect(closeButton).toBeInTheDocument();
  });

  it('should call minimizeWindow when minimize button is clicked', () => {
    render(<TitleBar />);
    const minimizeButton = screen.getByTitle('Minimize');
    fireEvent.click(minimizeButton);
    expect((window as any).electronAPI.minimizeWindow).toHaveBeenCalled();
  });

  it('should call maximizeWindow when maximize button is clicked', () => {
    render(<TitleBar />);
    const maximizeButton = screen.getByTitle('Maximize');
    fireEvent.click(maximizeButton);
    expect((window as any).electronAPI.maximizeWindow).toHaveBeenCalled();
  });

  it('should call closeWindow when close button is clicked', () => {
    render(<TitleBar />);
    const closeButton = screen.getByTitle('Close');
    fireEvent.click(closeButton);
    expect((window as any).electronAPI.closeWindow).toHaveBeenCalled();
  });

  it('should not crash when electronAPI is not available', () => {
    const originalAPI = (window as any).electronAPI;
    (window as any).electronAPI = undefined;
    render(<TitleBar />);
    const minimizeButton = screen.getByTitle('Minimize');
    expect(() => fireEvent.click(minimizeButton)).not.toThrow();
    // Restore for other tests
    (window as any).electronAPI = originalAPI;
  });
});
