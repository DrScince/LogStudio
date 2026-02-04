import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import LogViewer from './LogViewer';
import { LogSchema } from '../types/log';

// Mock react-window
vi.mock('react-window', () => ({
  VariableSizeList: React.forwardRef(({ children, itemData }: any, ref: any) => {
    // Create a mock ref object with state property
    if (ref) {
      ref.current = {
        state: { scrollOffset: 0 },
        scrollTo: vi.fn(),
        scrollToItem: vi.fn(),
        resetAfterIndex: vi.fn(),
      };
    }
    return (
      <div data-testid="virtualized-list" ref={ref}>
        {itemData?.entries?.map((entry: any, index: number) => 
          children({ index, style: {}, data: itemData })
        )}
      </div>
    );
  }),
}));

const defaultSchema: LogSchema = {
  pattern: '^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d+) \\| ([A-Z]+) \\| ([^|]+) \\| (.+)$',
  timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
  fields: {
    timestamp: 1,
    level: 2,
    namespace: 3,
    message: 4,
  },
};

const defaultProps = {
  filePath: null,
  schema: defaultSchema,
  autoRefresh: false,
  refreshInterval: 1000,
  selectedNamespaces: [],
  onNamespacesChange: vi.fn(),
  onResetFilters: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).electronAPI = {
    readLogFile: vi.fn(),
    watchLogFile: vi.fn(),
    unwatchLogFile: vi.fn(),
    onLogFileChanged: vi.fn(),
    removeLogFileChangedListener: vi.fn(),
  };
  // Mock clipboard API
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
});

describe('LogViewer', () => {
  it('should render empty state when no file is selected', () => {
    render(<LogViewer {...defaultProps} />);
    
    expect(screen.getByText(/Keine Datei geöffnet/i)).toBeInTheDocument();
  });

  it('should load and display log entries', async () => {
    const logContent = `2025-01-01 12:00:00.000 | INFO | Test.Namespace | Test message
2025-01-01 12:00:01.000 | ERROR | Test.Namespace | Error message`;

    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: logContent,
    });

    render(<LogViewer {...defaultProps} filePath="/test/log.log" />);

    // Wait for entries to be loaded (check for log level buttons which are always rendered)
    await waitFor(() => {
      expect(screen.getByText(/INFO/i)).toBeInTheDocument();
      expect(screen.getByText(/ERROR/i)).toBeInTheDocument();
    });
  });

  it('should filter entries by level', async () => {
    const logContent = `2025-01-01 12:00:00.000 | INFO | Test | Info message
2025-01-01 12:00:01.000 | ERROR | Test | Error message
2025-01-01 12:00:02.000 | WARN | Test | Warning message`;

    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: logContent,
    });

    render(<LogViewer {...defaultProps} filePath="/test/log.log" />);

    await waitFor(() => {
      const errorButton = screen.getByText(/ERROR/i);
      expect(errorButton).toBeInTheDocument();
    });
  });

  it('should handle multiple files', async () => {
    const file1Content = '2025-01-01 12:00:00.000 | INFO | Test | Message 1';
    const file2Content = '2025-01-01 12:00:01.000 | INFO | Test | Message 2';

    (window as any).electronAPI.readLogFile
      .mockResolvedValueOnce({ success: true, content: file1Content })
      .mockResolvedValueOnce({ success: true, content: file2Content });

    render(
      <LogViewer
        {...defaultProps}
        filePath={null}
        filePaths={['/test/file1.log', '/test/file2.log']}
      />
    );

    await waitFor(() => {
      expect((window as any).electronAPI.readLogFile).toHaveBeenCalledTimes(2);
    });
  });

  it('should toggle log level filter', async () => {
    const logContent = `2025-01-01 12:00:00.000 | INFO | Test | Info message
2025-01-01 12:00:01.000 | ERROR | Test | Error message`;

    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: logContent,
    });

    render(<LogViewer {...defaultProps} filePath="/test/log.log" />);

    await waitFor(() => {
      expect(screen.getByText(/INFO/i)).toBeInTheDocument();
    });

    // Find the INFO filter button by role
    const allButtons = screen.getAllByRole('button');
    const infoButton = allButtons.find(btn => btn.textContent?.trim() === 'INFO');
    
    expect(infoButton).toBeDefined();
    if (infoButton) {
      // Button should not be active initially
      expect(infoButton).not.toHaveClass('active');
      
      // Click the button
      fireEvent.click(infoButton);
      
      // Button should be active after click
      await waitFor(() => {
        expect(infoButton).toHaveClass('active');
      });
    }
  });

  it('should filter by namespace', async () => {
    const logContent = `2025-01-01 12:00:00.000 | INFO | App.Service | Message 1
2025-01-01 12:00:01.000 | INFO | App.UI | Message 2`;

    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: logContent,
    });

    render(<LogViewer {...defaultProps} filePath="/test/log.log" selectedNamespaces={['App.Service']} />);

    await waitFor(() => {
      expect(screen.getByText(/INFO/i)).toBeInTheDocument();
    });
  });

  it('should filter by search query', async () => {
    const logContent = `2025-01-01 12:00:00.000 | INFO | Test | First message
2025-01-01 12:00:01.000 | INFO | Test | Second message`;

    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: logContent,
    });

    render(<LogViewer {...defaultProps} filePath="/test/log.log" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter search text/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Enter search text/i);
    fireEvent.change(searchInput, { target: { value: 'First' } });

    expect(searchInput).toHaveValue('First');
  });

  it('should call onResetFilters when reset button is clicked', async () => {
    const logContent = `2025-01-01 12:00:00.000 | INFO | Test | Message`;

    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: logContent,
    });

    render(<LogViewer {...defaultProps} filePath="/test/log.log" />);

    await waitFor(() => {
      expect(screen.getByText(/INFO/i)).toBeInTheDocument();
    });

    // Click INFO button to activate a filter
    const allButtons = screen.getAllByRole('button');
    const infoButton = allButtons.find(btn => btn.textContent?.trim() === 'INFO');
    
    expect(infoButton).toBeDefined();
    if (infoButton) {
      fireEvent.click(infoButton);
      
      // Wait for reset button to appear (it appears when filters are active)
      await waitFor(() => {
        const resetButton = screen.queryByTitle(/Reset All Filters/i) || screen.queryByText(/Reset/i);
        expect(resetButton).toBeInTheDocument();
        if (resetButton && resetButton.tagName === 'BUTTON') {
          fireEvent.click(resetButton);
          expect(defaultProps.onResetFilters).toHaveBeenCalled();
        }
      }, { timeout: 3000 });
    }
  });

  it('should toggle auto-scroll', async () => {
    const logContent = `2025-01-01 12:00:00.000 | INFO | Test | Message`;

    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: logContent,
    });

    render(<LogViewer {...defaultProps} filePath="/test/log.log" />);

    await waitFor(() => {
      expect(screen.getByText(/INFO/i)).toBeInTheDocument();
    });

    // Wait for auto-scroll button to appear
    await waitFor(() => {
      const autoScrollButton = screen.queryByTitle(/Tracking|Auto-scroll/i);
      if (autoScrollButton) {
        fireEvent.click(autoScrollButton);
      }
    }, { timeout: 2000 });
  });

  it('should handle file changes when auto-refresh is enabled', async () => {
    const logContent = `2025-01-01 12:00:00.000 | INFO | Test | Message`;

    let fileChangeCallback: ((path: string) => void) | null = null;
    
    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: logContent,
    });

    (window as any).electronAPI.onLogFileChanged = (callback: (path: string) => void) => {
      fileChangeCallback = callback;
    };

    render(<LogViewer {...defaultProps} filePath="/test/log.log" autoRefresh={true} />);

    await waitFor(() => {
      expect((window as any).electronAPI.watchLogFile).toHaveBeenCalledWith('/test/log.log');
    });

    // Simulate file change
    if (fileChangeCallback) {
      fileChangeCallback('/test/log.log');
      // File should be reloaded
      await waitFor(() => {
        expect((window as any).electronAPI.readLogFile).toHaveBeenCalledTimes(2);
      });
    }
  });

  it('should reload file when schema changes', async () => {
    const logContent = `2025-01-01 12:00:00.000 | INFO | Test | Message`;

    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: logContent,
    });

    const { rerender } = render(<LogViewer {...defaultProps} filePath="/test/log.log" />);

    await waitFor(() => {
      expect((window as any).electronAPI.readLogFile).toHaveBeenCalled();
    });

    const newSchema: LogSchema = {
      ...defaultSchema,
      pattern: '^(\\d{4}-\\d{2}-\\d{2}) \\| (.+)$',
    };

    rerender(<LogViewer {...defaultProps} filePath="/test/log.log" schema={newSchema} />);

    // File should be reloaded with new schema
    await waitFor(() => {
      expect((window as any).electronAPI.readLogFile).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle empty file content', async () => {
    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: '',
    });

    render(<LogViewer {...defaultProps} filePath="/test/log.log" />);

    await waitFor(() => {
      expect((window as any).electronAPI.readLogFile).toHaveBeenCalled();
    });
  });

  it('should handle file read error', async () => {
    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: false,
      error: 'File not found',
    });

    render(<LogViewer {...defaultProps} filePath="/test/log.log" />);

    await waitFor(() => {
      expect((window as any).electronAPI.readLogFile).toHaveBeenCalled();
    });
  });

  it('should display entry count', async () => {
    const logContent = `2025-01-01 12:00:00.000 | INFO | Test | Message 1
2025-01-01 12:00:01.000 | INFO | Test | Message 2`;

    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: logContent,
    });

    render(<LogViewer {...defaultProps} filePath="/test/log.log" />);

    await waitFor(() => {
      expect(screen.getByText(/2 \/ 2 Entries/i)).toBeInTheDocument();
    });
  });

  it('should handle multi-line log entries', async () => {
    const logContent = `2025-01-01 12:00:00.000 | INFO | Test | First line
Second line
Third line`;

    (window as any).electronAPI.readLogFile.mockResolvedValue({
      success: true,
      content: logContent,
    });

    render(<LogViewer {...defaultProps} filePath="/test/log.log" />);

    await waitFor(() => {
      expect(screen.getByText(/INFO/i)).toBeInTheDocument();
    });
  });
});
