import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { filterDirectoryIcons } from '../utils/directoryIcons';
import './DirectoryPickers.css';

interface DirectoryIconPickerProps {
  value?: string;
  onChange: (iconId: string | undefined) => void;
  clearLabel?: string;
  searchPlaceholder?: string;
}

const DirectoryIconPicker: React.FC<DirectoryIconPickerProps> = ({
  value,
  onChange,
  clearLabel = 'None',
  searchPlaceholder = 'Search icons…',
}) => {
  const [query, setQuery] = useState('');
  const icons = useMemo(() => filterDirectoryIcons(query), [query]);

  return (
    <div className="dir-icon-picker-wrap">
      <input
        type="search"
        className="dir-icon-picker-search"
        value={query}
        placeholder={searchPlaceholder}
        onChange={(e) => setQuery(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        autoFocus
      />
      <div className="dir-icon-picker">
        <button
          type="button"
          className={`dir-icon-picker-item ${!value ? 'selected' : ''}`}
          title={clearLabel}
          onClick={() => onChange(undefined)}
        >
          —
        </button>
        {icons.map(({ id, icon }) => (
          <button
            key={id}
            type="button"
            className={`dir-icon-picker-item ${value === id ? 'selected' : ''}`}
            title={id}
            onClick={() => onChange(id)}
          >
            <FontAwesomeIcon icon={icon} />
          </button>
        ))}
        {icons.length === 0 && (
          <div className="dir-icon-picker-empty">—</div>
        )}
      </div>
    </div>
  );
};

export default DirectoryIconPicker;
