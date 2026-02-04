import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AboutPanel from './AboutPanel';

// Mock fetch for changelog
global.fetch = vi.fn();

describe('AboutPanel', () => {
  const defaultProps = {
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render about panel', () => {
    render(<AboutPanel {...defaultProps} />);
    
    expect(screen.getByText(/About/i)).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<AboutPanel onClose={onClose} />);
    
    const closeButton = screen.getByText('✕');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('should display version information', () => {
    render(<AboutPanel {...defaultProps} />);
    
    // Version should be displayed (from AboutPanel component)
    expect(screen.getByText(/1\.1\.0/i)).toBeInTheDocument();
  });

  it('should load and display changelog', async () => {
    // Mock electronAPI.readChangelog
    const mockChangelog = `# Changelog

## [1.2.0] - 2025-02-04

### Added
- New feature`;

    (window as any).electronAPI = {
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
