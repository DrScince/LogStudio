export interface ReleaseNote {
  version: string;
  date: string;
  added?: string[];
  changed?: string[];
  fixed?: string[];
}

/**
 * Parst die CHANGELOG.md und extrahiert die Release Notes
 */
export function parseChangelog(changelogContent: string): ReleaseNote[] {
  const releases: ReleaseNote[] = [];
  const lines = changelogContent.split('\n');
  
  let currentRelease: ReleaseNote | null = null;
  let currentSection: 'added' | 'changed' | 'fixed' | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Überspringe leere Zeilen und Header
    if (!line || line.startsWith('# Changelog') || line.startsWith('All notable')) {
      continue;
    }
    
    // Erkenne Versions-Header: ## [1.1.0] - 2026-02-03
    const versionMatch = line.match(/^## \[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/);
    if (versionMatch) {
      // Speichere vorherigen Release
      if (currentRelease) {
        releases.push(currentRelease);
      }
      
      // Starte neuen Release
      currentRelease = {
        version: versionMatch[1],
        date: versionMatch[2] || '',
        added: [],
        changed: [],
        fixed: [],
      };
      currentSection = null;
      continue;
    }
    
    // Überspringe [Unreleased] Abschnitt
    if (line.startsWith('## [Unreleased]')) {
      // Speichere vorherigen Release falls vorhanden
      if (currentRelease) {
        releases.push(currentRelease);
        currentRelease = null;
      }
      currentSection = null;
      continue;
    }
    
    // Erkenne Sektionen: ### Added, ### Changed, ### Fixed
    if (line.startsWith('### ')) {
      const section = line.substring(4).toLowerCase();
      if (section === 'added') {
        currentSection = 'added';
      } else if (section === 'changed') {
        currentSection = 'changed';
      } else if (section === 'fixed') {
        currentSection = 'fixed';
      } else {
        currentSection = null;
      }
      continue;
    }
    
    // Erkenne Listeneinträge: - **Text** oder - Text
    if (line.startsWith('- ')) {
      if (!currentRelease) continue;
      
      // Entferne Markdown-Formatierung (**text** wird zu text)
      let item = line.substring(2).trim();
      item = item.replace(/\*\*(.+?)\*\*/g, '$1'); // Entferne **bold**
      item = item.replace(/\*(.+?)\*/g, '$1'); // Entferne *italic*
      
      if (currentSection === 'added' && currentRelease.added) {
        currentRelease.added.push(item);
      } else if (currentSection === 'changed' && currentRelease.changed) {
        currentRelease.changed.push(item);
      } else if (currentSection === 'fixed' && currentRelease.fixed) {
        currentRelease.fixed.push(item);
      }
      continue;
    }
    
    // Erkenne Link-Zeilen (ignoriere sie)
    if (line.startsWith('[') && line.includes(']:')) {
      continue;
    }
  }
  
  // Speichere letzten Release
  if (currentRelease) {
    releases.push(currentRelease);
  }
  
  return releases;
}
