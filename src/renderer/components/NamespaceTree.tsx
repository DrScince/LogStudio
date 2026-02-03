import React, { useState, useMemo } from 'react';
import './NamespaceTree.css';

interface NamespaceNode {
  name: string;
  fullPath: string;
  children: Map<string, NamespaceNode>;
  count: number;
}

interface NamespaceTreeProps {
  namespaces: string[];
  selectedNamespaces: string[];
  onNamespaceToggle: (namespace: string) => void;
}

const NamespaceTree: React.FC<NamespaceTreeProps> = ({
  namespaces,
  selectedNamespaces,
  onNamespaceToggle,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Build tree structure from namespaces
  const tree = useMemo(() => {
    const root: NamespaceNode = {
      name: '',
      fullPath: '',
      children: new Map(),
      count: 0,
    };

    namespaces.forEach((namespace) => {
      const parts = namespace.split('.');
      let current = root;

      parts.forEach((part, index) => {
        if (!current.children.has(part)) {
          const fullPath = parts.slice(0, index + 1).join('.');
          current.children.set(part, {
            name: part,
            fullPath,
            children: new Map(),
            count: 0,
          });
        }
        current = current.children.get(part)!;
        current.count++;
      });
    });

    return root;
  }, [namespaces]);

  const toggleExpand = (fullPath: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fullPath)) {
        newSet.delete(fullPath);
      } else {
        newSet.add(fullPath);
      }
      return newSet;
    });
  };

  // Check if a namespace or any of its parents is selected (hierarchical)
  const isNamespaceIncluded = (namespacePath: string): boolean => {
    // Check exact match
    if (selectedNamespaces.includes(namespacePath)) {
      return true;
    }
    // Check if a parent namespace is selected
    return selectedNamespaces.some((selected) => {
      return namespacePath.startsWith(selected + '.');
    });
  };

  const renderNode = (node: NamespaceNode, level: number = 0): React.ReactNode => {
    if (node.fullPath === '') {
      // Root node - render all children
      return Array.from(node.children.values()).map((child) => renderNode(child, 0));
    }

    const hasChildren = node.children.size > 0;
    const isExpanded = expandedNodes.has(node.fullPath);
    const isSelected = selectedNamespaces.includes(node.fullPath);
    const isIncluded = isNamespaceIncluded(node.fullPath);
    const indent = level * 16;

    return (
      <div key={node.fullPath} className="namespace-tree-node">
        <div
          className={`namespace-tree-item ${isSelected ? 'selected' : ''} ${isIncluded && !isSelected ? 'included' : ''}`}
          style={{ paddingLeft: `${12 + indent}px` }}
          onClick={() => onNamespaceToggle(node.fullPath)}
        >
          {hasChildren && (
            <button
              className="namespace-tree-toggle"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.fullPath);
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span className="namespace-tree-spacer" />}
          <span className="namespace-tree-name">{node.name}</span>
          <span className="namespace-tree-count">({node.count})</span>
        </div>
        {hasChildren && isExpanded && (
          <div className="namespace-tree-children">
            {Array.from(node.children.values()).map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (namespaces.length === 0) {
    return (
      <div className="namespace-tree-empty">
        Keine Namespaces gefunden
      </div>
    );
  }

  return (
    <div className="namespace-tree">
      {renderNode(tree)}
    </div>
  );
};

export default NamespaceTree;
