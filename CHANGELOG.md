# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/yourusername/LogStudio/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/yourusername/LogStudio/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/yourusername/LogStudio/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/yourusername/LogStudio/releases/tag/v1.0.0
