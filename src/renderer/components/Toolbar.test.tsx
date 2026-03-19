import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar, { Tab } from './Toolbar';

describe('Toolbar', () => {
  const defaultProps = {
    tabs: [] as Tab[],
    activeTabId: null,
    onTabSelect: vi.fn(),
    onTabClose: vi.fn(),
    onCloseAll: vi.fn(),
    onCloseOthers: vi.fn(),
  };

  it('should return null when no tabs are open', () => {
    const { container } = render(<Toolbar {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('should display tabs', () => {
    const tabs: Tab[] = [
      { id: 'tab1', filePath: '/test/file1.log', selectedNamespaces: [], namespaces: [] },
      { id: 'tab2', filePath: '/test/file2.log', selectedNamespaces: [], namespaces: [] },
    ];
    render(<Toolbar {...defaultProps} tabs={tabs} />);
    expect(screen.getByText('file1.log')).toBeInTheDocument();
    expect(screen.getByText('file2.log')).toBeInTheDocument();
  });

  it('should display "X Dateien" for tabs with multiple files', () => {
    const tabs: Tab[] = [
      {
        id: 'tab1',
        filePath: '/test/file1.log',
        filePaths: ['/test/file1.log', '/test/file2.log'],
        selectedNamespaces: [],
        namespaces: [],
      },
    ];
    render(<Toolbar {...defaultProps} tabs={tabs} />);
    expect(screen.getByText('2 Dateien')).toBeInTheDocument();
  });

  it('should call onTabSelect when tab is clicked', () => {
    const onTabSelect = vi.fn();
    const tabs: Tab[] = [
      { id: 'tab1', filePath: '/test/file1.log', selectedNamespaces: [], namespaces: [] },
    ];
    render(<Toolbar {...defaultProps} tabs={tabs} onTabSelect={onTabSelect} />);
    fireEvent.click(screen.getByText('file1.log'));
    expect(onTabSelect).toHaveBeenCalledWith('tab1');
  });

  it('should highlight active tab', () => {
    const tabs: Tab[] = [
      { id: 'tab1', filePath: '/test/file1.log', selectedNamespaces: [], namespaces: [] },
    ];
    render(<Toolbar {...defaultProps} tabs={tabs} activeTabId="tab1" />);
    expect(screen.getByText('file1.log').closest('.toolbar-tab')).toHaveClass('active');
  });
});
