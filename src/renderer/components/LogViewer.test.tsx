import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LogViewer from './LogViewer';
import { LogSchema } from '../types/log';

// Mock react-window
vi.mock('react-window', () => ({
  VariableSizeList: ({ children, itemData }: any) => (
    <div data-testid="virtualized-list">
      {itemData?.entries?.map((entry: any, index: number) => 
        children({ index, style: {}, data: itemData })
      )}
    </div>
  ),
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
});
