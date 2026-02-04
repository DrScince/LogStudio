import React, { useState, useEffect } from 'react';
import { parseChangelog, ReleaseNote } from '../utils/changelogParser';
import './AboutPanel.css';

interface AboutPanelProps {
  onClose: () => void;
}

const APP_VERSION = '1.1.0';

const AboutPanel: React.FC<AboutPanelProps> = ({ onClose }) => {
  const [showChangelog, setShowChangelog] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChangelog = async () => {
      if (!window.electronAPI) {
        setLoading(false);
        return;
      }
      
      try {
        const result = await window.electronAPI.readChangelog();
        if (result.success && result.content) {
          const parsed = parseChangelog(result.content);
          setReleaseNotes(parsed);
        }
      } catch (error) {
        console.error('Error loading changelog:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadChangelog();
  }, []);
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const openGitHub = () => {
    if (window.electronAPI) {
      window.electronAPI.openExternal('https://github.com/DrScince/LogStudio');
    }
  };

  return (
    <div className="about-overlay" onClick={handleOverlayClick}>
      <div className="about-panel">
        <div className="about-header">
          <h2>About LogStudio</h2>
          <button className="about-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="about-content">
          <div className="about-logo">
            <img src="LogStudio_Logo.png" alt="LogStudio Logo" />
          </div>
          
          <div className="about-section">
            <h3>LogStudio</h3>
            <p className="about-version">Version {APP_VERSION}</p>
            <p className="about-description">
              A modern, cross-platform application for viewing and monitoring log files.
              Built with Electron, React, and TypeScript.
            </p>
            <button 
              className="about-changelog-button" 
              onClick={() => setShowChangelog(!showChangelog)}
            >
              {showChangelog ? '▼' : '▶'} Version History
            </button>
          </div>

          {showChangelog && (
            <div className="about-section about-changelog">
              <h4>Version History</h4>
              {loading ? (
                <div className="changelog-loading">Loading changelog...</div>
              ) : releaseNotes.length > 0 ? (
                <div className="changelog-list">
                  {releaseNotes.map((release, index) => (
                    <ReleaseNoteItem key={release.version} release={release} isLatest={index === 0} />
                  ))}
                </div>
              ) : (
                <div className="changelog-error">Unable to load changelog</div>
              )}
            </div>
          )}

          <div className="about-section">
            <h4>Features</h4>
            <ul className="about-features">
              <li>Real-time log file monitoring</li>
              <li>Advanced filtering (Level, Namespace, Full-text)</li>
              <li>JSON/XML/Exception auto-detection and formatting</li>
              <li>Multi-line log entry support</li>
              <li>Performance-optimized with virtualization</li>
            </ul>
          </div>

          <div className="about-section">
            <h4>Technology Stack</h4>
            <div className="about-tech">
              <span className="tech-badge">Electron 28.0.0</span>
              <span className="tech-badge">React 18.2.0</span>
              <span className="tech-badge">TypeScript 5.3.3</span>
              <span className="tech-badge">Vite 5.0.8</span>
            </div>
          </div>

          <div className="about-section">
            <h4>GitHub Repository</h4>
            <button className="about-github-button" onClick={openGitHub}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              View on GitHub
            </button>
          </div>

          <div className="about-section">
            <h4>License</h4>
            <p className="about-license">
              MIT License
            </p>
            <p className="about-license-text">
              Copyright © 2026 LogStudio Contributors
            </p>
            <p className="about-license-text">
              Permission is hereby granted, free of charge, to any person obtaining a copy
              of this software and associated documentation files (the "Software"), to deal
              in the Software without restriction, including without limitation the rights
              to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
              copies of the Software, and to permit persons to whom the Software is
              furnished to do so, subject to the following conditions:
            </p>
            <p className="about-license-text">
              The above copyright notice and this permission notice shall be included in all
              copies or substantial portions of the Software.
            </p>
            <p className="about-license-text">
              THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ReleaseNoteItemProps {
  release: ReleaseNote;
  isLatest: boolean;
}

const ReleaseNoteItem: React.FC<ReleaseNoteItemProps> = ({ release, isLatest }) => {
  const [expanded, setExpanded] = useState(isLatest);

  return (
    <div className={`changelog-item ${isLatest ? 'latest' : ''}`}>
      <div className="changelog-header" onClick={() => setExpanded(!expanded)}>
        <span className="changelog-version">v{release.version}</span>
        <span className="changelog-date">{release.date}</span>
        <span className="changelog-toggle">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && (
        <div className="changelog-content">
          {release.added && release.added.length > 0 && (
            <div className="changelog-section">
              <h5 className="changelog-section-title added">Added</h5>
              <ul className="changelog-list-items">
                {release.added.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {release.changed && release.changed.length > 0 && (
            <div className="changelog-section">
              <h5 className="changelog-section-title changed">Changed</h5>
              <ul className="changelog-list-items">
                {release.changed.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {release.fixed && release.fixed.length > 0 && (
            <div className="changelog-section">
              <h5 className="changelog-section-title fixed">Fixed</h5>
              <ul className="changelog-list-items">
                {release.fixed.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AboutPanel;
