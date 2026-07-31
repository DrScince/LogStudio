import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sidebar from './Sidebar';

// Mock electronAPI
const mockElectronAPI = {
  listLogFiles: vi.fn(),
  watchDirectory: vi.fn(),
  unwatchDirectory: vi.fn(),
  onDirectoryChanged: vi.fn().mockReturnValue(vi.fn()),
  removeDirectoryChangedListener: vi.fn(),
  showItemInFolder: vi.fn(),
  openFileInEditor: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).electronAPI = mockElectronAPI;
});

describe('Sidebar', () => {
  const defaultProps = {
    logDirectories: ['/test/logs'],
    activeDirectory: '/test/logs',
    onDirectorySelect: vi.fn(),
    onAddDirectory: vi.fn(),
    onRemoveDirectory: vi.fn(),
    onLogFileSelect: vi.fn(),
    onLogFilesSelect: vi.fn(),
    currentFile: null,
    selectedFiles: [],
    activeTabFiles: [],
  };

  it('should render empty state when no log directory is set', () => {
    render(<Sidebar {...defaultProps} logDirectories={[]} activeDirectory="" />);
    
    expect(screen.getByText(/Please select a log directory/i)).toBeInTheDocument();
  });

  it('should show loading state', async () => {
    mockElectronAPI.listLogFiles.mockResolvedValue({
      success: true,
      files: [],
    });

    render(<Sidebar {...defaultProps} />);
    
    // Should show loading initially
    await waitFor(() => {
      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
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

  it('should show file context menu and open in explorer or editor', async () => {
    const mockFiles = [
      { name: 'test.log', path: '/test/logs/test.log' },
    ];

    mockElectronAPI.listLogFiles.mockResolvedValue({
      success: true,
      files: mockFiles,
    });

    render(<Sidebar {...defaultProps} editorOrder={['vscode']} />);

    const fileItem = await screen.findByText('test.log');
    fireEvent.contextMenu(fileItem);

    const explorerBtn = await screen.findByText(/Explorer/i);
    fireEvent.click(explorerBtn);
    expect(mockElectronAPI.showItemInFolder).toHaveBeenCalledWith('/test/logs/test.log');

    fireEvent.contextMenu(fileItem);
    const editorBtn = await screen.findByText(/editor/i);
    fireEvent.click(editorBtn);
    expect(mockElectronAPI.openFileInEditor).toHaveBeenCalledWith('/test/logs/test.log', 1, ['vscode']);
  });

  it('should render color marker and icon on directory tab', () => {
    mockElectronAPI.listLogFiles.mockResolvedValue({ success: true, files: [] });

    const { container } = render(
      <Sidebar
        {...defaultProps}
        directoryMeta={{
          '/test/logs': { label: 'Prod', icon: 'server', color: 'blue' },
        }}
      />
    );

    expect(container.querySelector('.sidebar-dir-tab.has-color')).toBeTruthy();
    expect(container.querySelector('.sidebar-dir-tab-icon')).toBeTruthy();
    expect(screen.getByText('Prod')).toBeInTheDocument();
  });

  it('should show icon and color options in directory context menu', async () => {
    mockElectronAPI.listLogFiles.mockResolvedValue({ success: true, files: [] });
    const onDirectoryMetaChange = vi.fn();

    render(
      <Sidebar
        {...defaultProps}
        onDirectoryMetaChange={onDirectoryMetaChange}
      />
    );

    const tab = screen.getByTitle('/test/logs');
    fireEvent.contextMenu(tab);

    expect(await screen.findByText(/Set icon/i)).toBeInTheDocument();
    expect(screen.getByText(/Set color/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Set icon/i));
    fireEvent.click(screen.getByTitle('database'));
    expect(onDirectoryMetaChange).toHaveBeenCalledWith({
      '/test/logs': { icon: 'database' },
    });
  });

  it('should list files from a virtual folder without watching the filesystem', async () => {
    const onCreateVirtualFolder = vi.fn();
    const onAddFilesToVirtualFolder = vi.fn();
    const folder = {
      id: 'vf-1',
      name: 'Pinned',
      filePaths: ['/elsewhere/app.log', '/tmp/error.log'],
    };

    render(
      <Sidebar
        {...defaultProps}
        activeDirectory="virtual:vf-1"
        virtualFolders={[folder]}
        onCreateVirtualFolder={onCreateVirtualFolder}
        onAddFilesToVirtualFolder={onAddFilesToVirtualFolder}
      />
    );

    expect(await screen.findByText('app.log')).toBeInTheDocument();
    expect(screen.getByText('error.log')).toBeInTheDocument();
    expect(mockElectronAPI.listLogFiles).not.toHaveBeenCalled();
    expect(mockElectronAPI.watchDirectory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('New virtual folder'));
    expect(onCreateVirtualFolder).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('Add files'));
    expect(onAddFilesToVirtualFolder).toHaveBeenCalledWith('vf-1');
  });
});
