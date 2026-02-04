import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './Sidebar';

// Mock electronAPI
const mockElectronAPI = {
  listLogFiles: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).electronAPI = mockElectronAPI;
});

describe('Sidebar', () => {
  const defaultProps = {
    logDirectory: '/test/logs',
    onLogFileSelect: vi.fn(),
    onLogFilesSelect: vi.fn(),
    currentFile: null,
    selectedFiles: [],
    activeTabFiles: [],
  };

  it('should render empty state when no log directory is set', () => {
    render(<Sidebar {...defaultProps} logDirectory="" />);
    
    expect(screen.getByText(/Please select a log directory/i)).toBeInTheDocument();
  });

  it('should show loading state', async () => {
    mockElectronAPI.listLogFiles.mockResolvedValue({
      success: true,
      files: [],
    });

    render(<Sidebar {...defaultProps} />);
    
    // Should show loading initially
    expect(screen.getByText(/Lade/i)).toBeInTheDocument();
  });

  it('should display log files when loaded', async () => {
    const mockFiles = [
      { name: '2025-01-01.log', path: '/test/logs/2025-01-01.log' },
      { name: '2025-01-02.log', path: '/test/logs/2025-01-02.log' },
    ];

    mockElectronAPI.listLogFiles.mockResolvedValue({
      success: true,
      files: mockFiles,
    });

    render(<Sidebar {...defaultProps} />);

    // Wait for files to load
    await screen.findByText('2025-01-01.log');
    
    expect(screen.getByText('2025-01-01.log')).toBeInTheDocument();
    expect(screen.getByText('2025-01-02.log')).toBeInTheDocument();
  });

  it('should call onLogFileSelect when file is clicked', async () => {
    const onLogFileSelect = vi.fn();
    const mockFiles = [
      { name: 'test.log', path: '/test/logs/test.log' },
    ];

    mockElectronAPI.listLogFiles.mockResolvedValue({
      success: true,
      files: mockFiles,
    });

    render(<Sidebar {...defaultProps} onLogFileSelect={onLogFileSelect} />);

    const fileItem = await screen.findByText('test.log');
    fireEvent.click(fileItem);

    expect(onLogFileSelect).toHaveBeenCalledWith('/test/logs/test.log');
  });

  it('should call onLogFilesSelect when file is clicked with Ctrl', async () => {
    const onLogFilesSelect = vi.fn();
    const mockFiles = [
      { name: 'test.log', path: '/test/logs/test.log' },
    ];

    mockElectronAPI.listLogFiles.mockResolvedValue({
      success: true,
      files: mockFiles,
    });

    render(<Sidebar {...defaultProps} onLogFilesSelect={onLogFilesSelect} activeTabFiles={[]} />);

    const fileItem = await screen.findByText('test.log');
    fireEvent.click(fileItem, { ctrlKey: true });

    expect(onLogFilesSelect).toHaveBeenCalled();
  });

  it('should highlight active file', async () => {
    const mockFiles = [
      { name: 'active.log', path: '/test/logs/active.log' },
      { name: 'inactive.log', path: '/test/logs/inactive.log' },
    ];

    mockElectronAPI.listLogFiles.mockResolvedValue({
      success: true,
      files: mockFiles,
    });

    render(
      <Sidebar
        {...defaultProps}
        currentFile="/test/logs/active.log"
      />
    );

    const activeFile = await screen.findByText('active.log');
    expect(activeFile.closest('.log-file-item')).toHaveClass('active');
  });
});
