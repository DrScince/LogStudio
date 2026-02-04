# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-02-04

### Added
- **Tooltips für abgeschnittenen Text**: Beim Hovern über lange Namespaces oder abgeschnittene Nachrichten wird der vollständige Text in einem Tooltip angezeigt
- **Regex-Pattern-Validierung**: Echtzeit-Validierung des Regex-Patterns in den Einstellungen mit Fehlermeldungen
- **Verbesserte Settings-Hilfetexte**: Beispiel-Pattern und Erklärungen für einfacheres Konfigurieren des Log-Schemas
- **Batch-Script für Windows**: `build-and-run.bat` für einfacheres Ausführen ohne PowerShell Execution Policy Probleme
- **Separate Namespace-Toolbar**: Namespace-Filter als separate, rechts platzierte, expandierbare Toolbar (nur sichtbar wenn Datei geöffnet, standardmäßig eingeklappt)
- **Expand/Collapse All Button**: Button in der Sidebar zum gleichzeitigen Auf- und Zuklappen aller Datei-Gruppen
- **Tab-Leiste integriert**: Tab-Leiste wurde in die Toolbar integriert, um Platz zu sparen und die UI zu vereinfachen
- **Mehrfachauswahl von Log-Dateien**: Mit Strg+Klick können mehrere Dateien ausgewählt werden, die dann als kombinierte Ansicht angezeigt werden (sortiert nach Timestamp). Dateien können zum aktiven Tab hinzugefügt werden
- **Versionshistorie im About-Panel**: Automatische Anzeige der Release Notes direkt aus der CHANGELOG.md
- **Tab-Tooltips**: Bei Tabs mit mehreren Dateien wird beim Hovern ein Tooltip mit allen Dateinamen angezeigt
- **Datei-Highlighting**: Dateien aus dem aktiven Tab werden in der Sidebar hervorgehoben

### Changed
- **Expander-Icon**: Deutlich kleineres und weniger aufdringliches Expander-Icon für bessere Optik
- **Schema-Einstellungen**: Änderungen am Regex-Pattern und anderen Schema-Einstellungen werden sofort wirksam und laden die Datei automatisch neu
- **Separator-Einstellung entfernt**: Separator-Feld aus Einstellungen entfernt, da es nicht verwendet wurde
- **Sidebar-Layout**: Sidebar zeigt jetzt nur noch Dateien, Namespace-Filter wurde in separate rechte Toolbar verschoben
- **Reset Filters Button**: Button wurde von der oberen Toolbar in die LogViewer-Toolbar verschoben (neben End-Button und Filter-Anzeige)
- **Font-Size-Einstellung**: Font-Size-Einstellung funktioniert jetzt und passt alle Schriftgrößen relativ zur Basis-Schriftgröße an (alle font-size Werte auf rem umgestellt)

### Fixed
- **Expansion nach Filteränderung**: Expandierte Zeilen bleiben nicht mehr an falscher Position nach Filteränderungen
- **List-Reset bei Filteränderung**: Bei großen Listen werden gefilterte Einträge sofort angezeigt, ohne dass man auf "End" klicken muss
- **Expansion basiert auf originalLineNumber**: Expansion wird jetzt korrekt anhand der originalen Zeilennummer identifiziert, nicht mehr über den Index

## [1.1.0] - 2026-02-03

### Added
- **Copy to Clipboard**: Copy button for JSON, XML, and Exception content in expanded view
- **DevTools Toggle**: Press F12 or Ctrl+Shift+I to toggle developer tools (development mode only)

### Changed
- **Incremental Log Loading**: Only new log entries are appended instead of reloading entire file, eliminating flickering
- **Optimized Scroll Behavior**: Scroll position is now preserved during file updates using useLayoutEffect
- **Improved Expanded View**: Fixed height (430px) with scrollable content (max 350px) for better consistency

### Fixed
- **Scroll Position Preservation**: Scroll position no longer jumps to top during file updates when tracking is disabled
- **Flickering Elimination**: Removed flickering during auto-refresh by appending new entries instead of re-rendering all entries
- **Loading State**: Loading indicator no longer flashes during incremental updates

## [1.0.2] - 2026-02-03

### Added
- **About Panel**: New About section with project information, GitHub link, and license details
- **Middle Mouse Button Close**: Tabs can now be closed by clicking with the middle mouse button
- **Custom Title Bar**: Application now uses a custom title bar with integrated logo
- **Reset Filters Button**: New button to reset all filters (namespace, level, search)
- **Exception Formatting**: Automatic detection and colored formatting of exceptions and stack traces
- **JSON/XML Auto-Detection**: Automatic detection and pretty-printing of JSON and XML in log entries
- **Auto-Tracking**: Button for automatic scrolling to the end when new log entries arrive
- **Jump to End**: Quick navigation to the end of the log file
- **Collapsible Date Groups**: Date groups in sidebar can be expanded/collapsed
- **Expandable Log Entries**: Long log entries can be expanded by clicking
- **Responsive Design**: Improved display for smaller window sizes
- **Application Icon**: LogStudio logo integrated as application icon
- **Screenshot in README**: UI overview added to README

### Changed
- **Auto-Refresh**: Switched from 5-second interval to real file watching with chokidar
- **Scrollbar Width**: Increased from 10px to 16px for better usability
- **Exception View**: Increased maximum height for better readability of stack traces
- **Date Parsing**: Fixed timezone handling for "Today/Yesterday" display

### Fixed
- **Auto-Refresh Reliability**: Improved file watching with better polling and event handling
- **Date Display**: Current files now correctly appear under "Today" instead of "Yesterday"
- **Text Overflow**: Fixed issues with overlapping text in expanded entries
- **Exception Scrolling**: Scrolling in expanded exception views now works correctly
- **Icon Display**: Application icon displays correctly in taskbar and header

## [1.0.1] - 2026-01-15

### Added
- Multi-line log entry support
- Namespace-based filtering
- Log level filtering
- Full-text search

### Changed
- Improved performance through virtualization

## [1.0.0] - 2026-01-01

### Added
- Initial release of LogStudio
- Log file viewer with modern UI
- Basic filtering by log level
- Configurable log schemas
- Settings panel
- Cross-platform support (Windows, Linux)

[Unreleased]: https://github.com/yourusername/LogStudio/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/yourusername/LogStudio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/yourusername/LogStudio/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/yourusername/LogStudio/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/yourusername/LogStudio/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/yourusername/LogStudio/releases/tag/v1.0.0
