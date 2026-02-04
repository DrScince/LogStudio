import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NamespaceToolbar from './NamespaceToolbar';

describe('NamespaceToolbar', () => {
  const mockOnNamespaceToggle = vi.fn();
  const defaultProps = {
    namespaces: ['App.Service', 'App.UI'],
    selectedNamespaces: [],
    onNamespaceToggle: mockOnNamespaceToggle,
    isVisible: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isVisible is false', () => {
    const { container } = render(<NamespaceToolbar {...defaultProps} isVisible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when isVisible is true', () => {
    render(<NamespaceToolbar {...defaultProps} />);
    expect(screen.getByText('Namespaces')).toBeInTheDocument();
  });

  it('should be collapsed by default', () => {
    const { container } = render(<NamespaceToolbar {...defaultProps} />);
    const toolbar = container.querySelector('.namespace-toolbar');
    expect(toolbar).toHaveClass('collapsed');
    expect(toolbar).not.toHaveClass('expanded');
  });

  it('should expand when header is clicked', () => {
    const { container } = render(<NamespaceToolbar {...defaultProps} />);
    const header = screen.getByText('Namespaces').closest('.namespace-toolbar-header');
    
    fireEvent.click(header!);
    
    const toolbar = container.querySelector('.namespace-toolbar');
    expect(toolbar).toHaveClass('expanded');
    expect(toolbar).not.toHaveClass('collapsed');
  });

  it('should collapse when header is clicked again', () => {
    const { container } = render(<NamespaceToolbar {...defaultProps} />);
    const header = screen.getByText('Namespaces').closest('.namespace-toolbar-header');
    
    // Expand
    fireEvent.click(header!);
    // Collapse
    fireEvent.click(header!);
    
    const toolbar = container.querySelector('.namespace-toolbar');
    expect(toolbar).toHaveClass('collapsed');
    expect(toolbar).not.toHaveClass('expanded');
  });

  it('should show expand arrow when collapsed', () => {
    render(<NamespaceToolbar {...defaultProps} />);
    expect(screen.getByText('▶')).toBeInTheDocument();
  });

  it('should show collapse arrow when expanded', () => {
    const { container } = render(<NamespaceToolbar {...defaultProps} />);
    const header = screen.getByText('Namespaces').closest('.namespace-toolbar-header');
    
    fireEvent.click(header!);
    
    expect(screen.getByText('◀')).toBeInTheDocument();
  });

  it('should render NamespaceTree when expanded', () => {
    const { container } = render(<NamespaceToolbar {...defaultProps} />);
    const header = screen.getByText('Namespaces').closest('.namespace-toolbar-header');
    
    fireEvent.click(header!);
    
    expect(screen.getByText('App')).toBeInTheDocument();
  });

  it('should pass namespaces to NamespaceTree', () => {
    const { container } = render(<NamespaceToolbar {...defaultProps} />);
    const header = screen.getByText('Namespaces').closest('.namespace-toolbar-header');
    
    fireEvent.click(header!);
    
    // NamespaceTree renders namespaces hierarchically, so we check for "App" which is the root
    expect(screen.getByText('App')).toBeInTheDocument();
  });

  it('should pass selectedNamespaces to NamespaceTree', () => {
    const { container } = render(
      <NamespaceToolbar {...defaultProps} selectedNamespaces={['App.Service']} />
    );
    const header = screen.getByText('Namespaces').closest('.namespace-toolbar-header');
    
    fireEvent.click(header!);
    
    // Check that App is rendered (root of the namespace tree)
    expect(screen.getByText('App')).toBeInTheDocument();
  });

  it('should pass onNamespaceToggle to NamespaceTree', () => {
    const { container } = render(<NamespaceToolbar {...defaultProps} />);
    const header = screen.getByText('Namespaces').closest('.namespace-toolbar-header');
    
    fireEvent.click(header!);
    
    // Click on "App" which should trigger the toggle
    const appElement = screen.getByText('App');
    fireEvent.click(appElement);
    
    expect(mockOnNamespaceToggle).toHaveBeenCalled();
  });
});
