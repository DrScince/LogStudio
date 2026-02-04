import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TabBar, { Tab } from './TabBar';

describe('TabBar', () => {
  const mockOnTabSelect = vi.fn();
  const mockOnTabClose = vi.fn();

  const defaultProps = {
    tabs: [],
    activeTabId: null,
    onTabSelect: mockOnTabSelect,
    onTabClose: mockOnTabClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when tabs array is empty', () => {
    const { container } = render(<TabBar {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render tabs when tabs array is not empty', () => {
    const tabs: Tab[] = [
      { id: '1', filePath: '/path/to/file1.log', selectedNamespaces: [], namespaces: [] },
      { id: '2', filePath: '/path/to/file2.log', selectedNamespaces: [], namespaces: [] },
    ];
    render(<TabBar {...defaultProps} tabs={tabs} />);
    expect(screen.getByText('file1.log')).toBeInTheDocument();
    expect(screen.getByText('file2.log')).toBeInTheDocument();
  });

  it('should highlight active tab', () => {
    const tabs: Tab[] = [
      { id: '1', filePath: '/path/to/file1.log', selectedNamespaces: [], namespaces: [] },
      { id: '2', filePath: '/path/to/file2.log', selectedNamespaces: [], namespaces: [] },
    ];
    render(<TabBar {...defaultProps} tabs={tabs} activeTabId="1" />);
    const tab1 = screen.getByText('file1.log').closest('.tab');
    const tab2 = screen.getByText('file2.log').closest('.tab');
    expect(tab1).toHaveClass('active');
    expect(tab2).not.toHaveClass('active');
  });

  it('should call onTabSelect when tab is clicked', () => {
    const tabs: Tab[] = [
      { id: '1', filePath: '/path/to/file1.log', selectedNamespaces: [], namespaces: [] },
    ];
    render(<TabBar {...defaultProps} tabs={tabs} />);
    fireEvent.click(screen.getByText('file1.log'));
    expect(mockOnTabSelect).toHaveBeenCalledWith('1');
  });

  it('should call onTabClose when close button is clicked', () => {
    const tabs: Tab[] = [
      { id: '1', filePath: '/path/to/file1.log', selectedNamespaces: [], namespaces: [] },
    ];
    render(<TabBar {...defaultProps} tabs={tabs} />);
    const closeButton = screen.getByTitle('Close Tab');
    const mockEvent = { stopPropagation: vi.fn() } as any;
    fireEvent.click(closeButton, mockEvent);
    expect(mockOnTabClose).toHaveBeenCalledWith('1', expect.any(Object));
  });

  it('should call onTabClose when middle mouse button is clicked', () => {
    const tabs: Tab[] = [
      { id: '1', filePath: '/path/to/file1.log', selectedNamespaces: [], namespaces: [] },
    ];
    render(<TabBar {...defaultProps} tabs={tabs} />);
    const tab = screen.getByText('file1.log').closest('.tab');
    const mockEvent = {
      button: 1,
      preventDefault: vi.fn(),
    } as any;
    // Simulate auxClick event
    fireEvent(tab!, new MouseEvent('auxclick', { button: 1, bubbles: true }));
    expect(mockOnTabClose).toHaveBeenCalledWith('1', expect.any(Object));
  });

  it('should not call onTabClose for other mouse buttons', () => {
    const tabs: Tab[] = [
      { id: '1', filePath: '/path/to/file1.log', selectedNamespaces: [], namespaces: [] },
    ];
    render(<TabBar {...defaultProps} tabs={tabs} />);
    const tab = screen.getByText('file1.log').closest('.tab');
    // Simulate auxClick with button 0 (left mouse button, not middle)
    fireEvent(tab!, new MouseEvent('auxclick', { button: 0, bubbles: true }));
    // The component only handles button 1 (middle mouse), so onTabClose should not be called
    expect(mockOnTabClose).not.toHaveBeenCalled();
  });

  it('should handle Windows path separators', () => {
    const tabs: Tab[] = [
      { id: '1', filePath: 'C:\\path\\to\\file1.log', selectedNamespaces: [], namespaces: [] },
    ];
    render(<TabBar {...defaultProps} tabs={tabs} />);
    expect(screen.getByText('file1.log')).toBeInTheDocument();
  });

  it('should handle Unix path separators', () => {
    const tabs: Tab[] = [
      { id: '1', filePath: '/path/to/file1.log', selectedNamespaces: [], namespaces: [] },
    ];
    render(<TabBar {...defaultProps} tabs={tabs} />);
    expect(screen.getByText('file1.log')).toBeInTheDocument();
  });

  it('should display "Unbekannt" for empty file path', () => {
    const tabs: Tab[] = [
      { id: '1', filePath: '', selectedNamespaces: [], namespaces: [] },
    ];
    render(<TabBar {...defaultProps} tabs={tabs} />);
    expect(screen.getByText('Unbekannt')).toBeInTheDocument();
  });
});
