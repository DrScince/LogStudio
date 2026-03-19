import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import AboutPanel from './AboutPanel';

// Mock fetch for changelog
global.fetch = vi.fn();

describe('AboutPanel', () => {
  const defaultProps = {
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).electronAPI = {
      getAppVersion: vi.fn().mockResolvedValue({ success: true, version: '1.2.3' }),
      readChangelog: vi.fn().mockResolvedValue({ success: false }),
    };
  });

  it('should render about panel', async () => {
    await act(async () => {
      render(<AboutPanel {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/About/i)).toBeInTheDocument();
    });
  });

  it('should call onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      render(<AboutPanel onClose={onClose} />);
    });
    
    await waitFor(() => {
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);
    });
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should display version information', async () => {
    (window as any).electronAPI = {
      getAppVersion: vi.fn().mockResolvedValue({ success: true, version: '1.2.3' }),
      readChangelog: vi.fn().mockResolvedValue({ success: false }),
    };

    await act(async () => {
      render(<AboutPanel {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/Version\s+1\.2\.3/i)).toBeInTheDocument();
    });
  });

  it('should load and display changelog', async () => {
    // Mock electronAPI.readChangelog
    const mockChangelog = `# Changelog

## [1.2.0] - 2025-02-04

### Added
- New feature`;

    (window as any).electronAPI = {
      getAppVersion: vi.fn().mockResolvedValue({ success: true, version: '1.2.3' }),
      readChangelog: vi.fn().mockResolvedValue({
        success: true,
        content: mockChangelog,
      }),
    };

    render(<AboutPanel {...defaultProps} />);
    
    const changelogButton = screen.getByText(/Version History/i);
    fireEvent.click(changelogButton);

    await waitFor(() => {
      expect(screen.getByText(/1\.2\.0/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
