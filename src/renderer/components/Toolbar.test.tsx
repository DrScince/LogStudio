import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar, { Tab } from './Toolbar';

describe('Toolbar', () => {
  const defaultProps = {
    onSettingsClick: vi.fn(),
    onAboutClick: vi.fn(),
    onOpenFile: vi.fn(),
    onThemeToggle: vi.fn(),
    currentTheme: 'dark' as const,
    currentFile: null,
    tabs: [] as Tab[],
    activeTabId: null,
    onTabSelect: vi.fn(),
    onTabClose: vi.fn(),
  };

  it('should render toolbar with logo and title', () => {
    render(<Toolbar {...defaultProps} />);
    
    expect(screen.getByText('LogStudio')).toBeInTheDocument();
  });

  it('should call onOpenFile when open button is clicked', () => {
    const onOpenFile = vi.fn();
    render(<Toolbar {...defaultProps} onOpenFile={onOpenFile} />);
    
    const openButton = screen.getByText(/Open/i);
    fireEvent.click(openButton);
    
    expect(onOpenFile).toHaveBeenCalled();
  });

  it('should call onSettingsClick when settings button is clicked', () => {
    const onSettingsClick = vi.fn();
    render(<Toolbar {...defaultProps} onSettingsClick={onSettingsClick} />);
    
    const settingsButton = screen.getByTitle(/Settings/i);
    fireEvent.click(settingsButton);
    
    expect(onSettingsClick).toHaveBeenCalled();
  });

  it('should display tabs', () => {
    const tabs: Tab[] = [
      {
        id: 'tab1',
        filePath: '/test/file1.log',
        selectedNamespaces: [],
        namespaces: [],
      },
      {
        id: 'tab2',
        filePath: '/test/file2.log',
        selectedNamespaces: [],
        namespaces: [],
      },
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
      {
        id: 'tab1',
        filePath: '/test/file1.log',
        selectedNamespaces: [],
        namespaces: [],
      },
    ];

    render(<Toolbar {...defaultProps} tabs={tabs} onTabSelect={onTabSelect} />);
    
    const tab = screen.getByText('file1.log');
    fireEvent.click(tab);
    
    expect(onTabSelect).toHaveBeenCalledWith('tab1');
  });

  it('should highlight active tab', () => {
    const tabs: Tab[] = [
      {
        id: 'tab1',
        filePath: '/test/file1.log',
        selectedNamespaces: [],
        namespaces: [],
      },
    ];

    render(<Toolbar {...defaultProps} tabs={tabs} activeTabId="tab1" />);
    
    const tab = screen.getByText('file1.log');
    expect(tab.closest('.toolbar-tab')).toHaveClass('active');
  });
});
