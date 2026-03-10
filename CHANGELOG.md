# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.3.1] - 2026-03-10

### Fixed
- **Last visible log entry**: Corrected the virtualized LogViewer height calculation so the final log row remains reachable below the column header
- **LogViewer regression coverage**: Added a dedicated test to lock in the header-aware list height behavior

## [1.3.0] - 2026-03-02

### Added
- **Resizable columns in LogViewer**: Timestamp, level, and namespace columns can be resized directly with the mouse
- **Startup update notification**: Automatic check for new GitHub releases on app start, including a download link
- **Folder picker in Settings**: A native folder dialog can now be opened to choose the log directory

### Changed
- **Search field under constrained width**: Compact search mode with magnifier button and dropdown input on narrow layouts
- **Filter/toolbar layout**: More stable behavior with many active filters, including ellipsis handling and improved alignment
- **File sidebar**: Left file sidebar is collapsible/expandable and expanded by default, including animation
- **Update banner visibility**: Stronger visual highlight for the update notification

### Fixed
- **CI/test error in LogViewer**: Added robust guards for virtual list ref methods (`scrollToItem`, `scrollTo`, `resetAfterIndex`)
- **Message tooltip**: Full message text is now shown consistently as a tooltip

## [1.2.0] - 2026-02-04

### Added
- **Tooltips for truncated text**: Hovering long namespaces or truncated messages shows the full text in a tooltip
- **Regex pattern validation**: Real-time validation of the regex pattern in Settings with error messages
- **Improved Settings help text**: Example patterns and explanations for easier log schema configuration
- **Windows batch script**: `build-and-run.bat` for easier execution without PowerShell execution policy issues
- **Separate namespace toolbar**: Namespace filters moved to a separate, right-side, expandable toolbar (visible only when a file is open, collapsed by default)
- **Expand/Collapse All button**: Sidebar button to expand or collapse all file groups at once
- **Integrated tab bar**: Tab bar moved into the toolbar to save space and simplify the UI
- **Multi-select log files**: Multiple files can be selected with Ctrl+click and shown in a combined view (sorted by timestamp); files can be added to the active tab
- **Version history in About panel**: Automatic display of release notes directly from `CHANGELOG.md`
- **Tab tooltips**: Hovering tabs with multiple files shows a tooltip listing all file names
- **File highlighting**: Files belonging to the active tab are highlighted in the sidebar

### Changed
- **Expander icon**: Smaller and less intrusive expander icon for a cleaner look
- **Schema settings**: Changes to regex pattern and other schema settings now apply immediately and trigger an automatic reload
- **Removed separator setting**: Separator field removed from Settings because it was unused
- **Sidebar layout**: Sidebar now shows files only; namespace filters moved to a separate right toolbar
- **Reset Filters button**: Moved from the top toolbar into the LogViewer toolbar (next to End button and filter indicators)
- **Font size setting**: Font size setting now works correctly and scales all text sizes relative to the base font size (font-size values converted to rem)

### Fixed
- **Expansion after filter changes**: Expanded rows no longer appear at incorrect positions after filtering
- **List reset on filter changes**: In large lists, filtered entries now appear immediately without needing to click "End"
- **Expansion based on original line number**: Expansion is now correctly keyed by `originalLineNumber` instead of list index

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

[Unreleased]: https://github.com/DrScince/LogStudio/compare/v1.3.1...HEAD
[1.3.1]: https://github.com/DrScince/LogStudio/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/DrScince/LogStudio/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/yourusername/LogStudio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/yourusername/LogStudio/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/yourusername/LogStudio/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/yourusername/LogStudio/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/yourusername/LogStudio/releases/tag/v1.0.0
