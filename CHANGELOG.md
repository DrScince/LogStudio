# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.2.0] - 2026-03-19

### Added
- **Check for Updates button**: A new button in the title bar lets users manually trigger an update check. A toast notification appears in the bottom-right corner when no update is available
- **Namespace tree auto-expand on filter**: When a namespace filter is selected, all ancestor nodes in the namespace tree are automatically expanded so the filtered entry is immediately visible

### Changed
- **Action buttons moved to title bar**: All action buttons (Open File, Settings, Theme toggle, Check for Updates, About) have been moved from the toolbar into the title bar; the toolbar now shows tabs only
- **Title bar drag region**: The entire title bar is draggable — individual buttons are excluded from the drag region
- **Namespace filter panel: collapsed by default**: The expand/collapse state of the namespace panel is a pure user decision with no automatic triggers

### Fixed
- **Namespace filter panel state lost on collapse/reopen**: Filter state and tree expansion are now correctly preserved across panel open/close cycles
- **"No update available" feedback**: Replaced the previous inline label with a 3-second toast notification in the bottom-right corner

## [2.1.5] - 2026-03-19

### Added
- **"Open with LogStudio" context menu entry**: The NSIS installer now registers a context menu entry for all files in Windows Explorer — similar to "Edit with Notepad++". The entry is added to `HKCU` (no admin rights needed) and is automatically removed on uninstall.

## [2.1.4] - 2026-03-19

### Fixed
- **Version number in About panel**: Version is now read at runtime via `app.getVersion()` (Electron IPC) instead of being injected at build time. This means the correct version is always shown, even in installed/portable builds. No more manual version updates needed — changing `package.json` is the single source of truth.

## [2.1.3] - 2026-03-18

### Fixed
- **App not starting after install (black screen)**: `__APP_VERSION__` was not correctly injected during Vite build due to a wrong `package.json` path in `vite.config.ts`. Replaced with `process.env.npm_package_version` which is always available when building via npm scripts. Added a `'0.0.0'` fallback as safety net.

## [2.1.2] - 2026-03-18

### Fixed
- **Version number in About panel**: Version is now read dynamically from `package.json` at build time — no more manual updates needed
- **CI tests**: AboutPanel test no longer depends on a hardcoded version string

## [2.1.1] - 2026-03-18

### Added
- **Scroll beyond last line**: The log viewer can now be scrolled past the last entry so it can be centered on screen (similar to VS Code)

### Fixed
- **About panel version**: Version number in the About panel was hardcoded and not updated with releases

## [2.1.0] - 2026-03-18

### Added
- **Right-click context menu on tabs**: Options to close all tabs or close all other tabs
- **Right-click context menu on log entries**: Copy entry to clipboard (timestamp, level, namespace, message) or open the source file directly in an editor at the exact line
- **Open in Editor**: Supports VS Code, Notepad++, and Notepad as fallback; tries each editor in configurable order
- **Configurable editor order in Settings**: Drag ▲/▼ buttons to set the preferred editor priority (VS Code → Notepad++ → Notepad)
- **Source file tracking for multi-file tabs**: "Open in Editor" correctly opens the originating file and line number even when multiple files are merged in one tab
- **File info in log context menu**: When multiple files are open, the context menu shows the source filename and line number of the selected entry

### Changed
- **Settings icon**: Replaced with a proper gear/cog icon
- **Theme toggle icons**: Dark mode shows a sun (switch to light), light mode shows a moon (switch to dark)
- **Refresh button in sidebar**: Replaced with a standard circular-arrow icon (Firefox/Edge style)
- **Toolbar buttons**: Increased size (32 px height, larger padding and icon size) for better usability
- **Logo and app title**: Moved exclusively to the title bar; toolbar now uses the full width for tabs and action buttons
- **VS Code-style tab bar**: Tabs span the full toolbar height with a blue top border on the active tab, close button visible only on hover
- **Tab wrapping**: Tabs wrap to multiple rows instead of scrolling off-screen when many files are open
- **Middle-mouse click closes tab**: Middle mouse button on a tab now reliably closes it
- **Single file click opens single tab**: Clicking a file in the sidebar that is part of a group tab now opens it as a standalone tab instead of switching to the group

### Fixed
- **Notepad++ detection**: Added multiple fallback paths (`notepad++` on PATH, `Program Files`, `Program Files (x86)`) to reliably find Notepad++
- **"Open in Editor" always opened first file**: Multi-file tabs now preserve the original source file path and line number per log entry

## [2.0.0] - 2026-03-17

### Added
- **Automatic updates (NSIS installer)**: The installer automatically checks for new versions on startup, downloads them in the background, and installs them with a single click
- **Update progress indicator**: Progress bar in the update banner shows download progress in percent
- **Portable build with update notification**: The portable EXE also detects new versions and shows a download link -- without automatic installation
- **Drag & Drop**: Log and text files can be dragged directly into the window and open as a new tab
- **File type validation on drop**: Unsupported file formats show an error banner listing the allowed extensions
- **Windows context menu "Open with LogStudio"**: The NSIS installer registers `.log` and `.txt` files -- right-clicking such a file now includes an entry to open it directly in LogStudio
- **Single-instance handling**: If LogStudio is launched via context menu while already running, the existing window is focused and the file is opened within it

### Changed
- **Build target**: The Windows build now produces both an NSIS installer and a portable EXE
- **Update mechanism**: Replaced manual GitHub API polling with `electron-updater` for the installer build


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
