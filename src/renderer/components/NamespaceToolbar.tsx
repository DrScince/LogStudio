import React, { useState } from 'react';
import NamespaceTree from './NamespaceTree';
import './NamespaceToolbar.css';

interface NamespaceToolbarProps {
  namespaces: string[];
  namespaceCounts?: Record<string, number>;
  selectedNamespaces: string[];
  onNamespaceToggle: (namespace: string) => void;
  isVisible: boolean;
}

const NamespaceToolbar: React.FC<NamespaceToolbarProps> = ({
  namespaces,
  namespaceCounts,
  selectedNamespaces,
  onNamespaceToggle,
  isVisible,
}) => {
  // Default: immer eingeklappt — reine Nutzerentscheidung
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`namespace-toolbar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="namespace-toolbar-header" onClick={handleToggle}>
        <span className="namespace-toolbar-title">Namespaces</span>
        <span className="namespace-toolbar-toggle">
          {isExpanded ? '◀' : '▶'}
        </span>
      </div>
      {isExpanded && (
        <div className="namespace-toolbar-content">
          <NamespaceTree
            namespaces={namespaces}
            namespaceCounts={namespaceCounts}
            selectedNamespaces={selectedNamespaces}
            onNamespaceToggle={onNamespaceToggle}
          />
        </div>
      )}
    </div>
  );
};

export default NamespaceToolbar;
