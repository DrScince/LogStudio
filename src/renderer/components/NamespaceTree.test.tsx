import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NamespaceTree from './NamespaceTree';

describe('NamespaceTree', () => {
  const defaultProps = {
    namespaces: ['App.Service', 'App.Other', 'App.Service.Sub'],
    selectedNamespaces: [],
    onNamespaceToggle: vi.fn(),
  };

  it('should render namespace tree', () => {
    render(<NamespaceTree {...defaultProps} />);
    
    // NamespaceTree renders hierarchically, so we see "App" as root
    expect(screen.getByText('App')).toBeInTheDocument();
  });

  it('should call onNamespaceToggle when namespace is clicked', () => {
    const onNamespaceToggle = vi.fn();
    render(<NamespaceTree {...defaultProps} onNamespaceToggle={onNamespaceToggle} />);
    
    // Click on root "App" node
    const namespace = screen.getByText('App');
    fireEvent.click(namespace);
    
    expect(onNamespaceToggle).toHaveBeenCalled();
  });

  it('should highlight selected namespaces', () => {
    render(
      <NamespaceTree
        {...defaultProps}
        selectedNamespaces={['App']}
      />
    );
    
    const namespace = screen.getByText('App');
    expect(namespace.closest('.namespace-tree-item')).toHaveClass('selected');
  });

  it('should show empty state when no namespaces', () => {
    render(<NamespaceTree {...defaultProps} namespaces={[]} />);
    
    expect(screen.getByText(/Keine Namespaces gefunden/i)).toBeInTheDocument();
  });
});
