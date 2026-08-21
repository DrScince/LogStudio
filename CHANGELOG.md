# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Local AI assistant (Ollama)**: In-app chat with open-log context. On first use, LogStudio launches the official Ollama installer; the model is pulled on first chat. LogStudio itself stays a normal slim install.

## [2.10.0] - 2026-08-19

### Added
- **Hidden new entries badge**: When a log-level or namespace filter is active and newly appended log lines don't match the filter, a pulsing badge in the toolbar shows how many new entries are currently hidden. Clicking the badge resets the filters and reveals them.

## [2.9.0] - 2026-08-07

### Added
- **RTF clipboard copy**: Copy log entries and JSON/XML payloads as rich text (plain + RTF) for pasting into Word/Outlook. Log toolbar button copies filtered entries; expand panels and context menus offer Copy / Copy as RTF.
- **Config context menu**: Right-click XML/JSON viewers for *Copy* and *Copy as RTF* (selection in Raw mode, otherwise full document).
- **XML enum options from comments**: Trailing `<!-- a;b;c -->` comments after leaf nodes provide a dropdown of allowed values in Tree view.
- **Persisted XML/JSON view state**: Raw/Tree mode and expanded/collapsed tree nodes are remembered per open tab across tab switches.

### Changed
- **Tree view hides XML comments**: Comments are no longer shown as tree rows (option comments still drive the value dropdown).

## [2.8.1] - 2026-07-31

### Fixed
- **Markdown editor scroll jump**: Editing no longer yank the caret/viewport when the live preview re-renders (scroll sync is one-way from the active pane; preview updates are debounced).
- **Blank window on `npm run dev`**: Vite now fails if port 5173 is taken instead of silently moving to another port; Electron waits for the Dev Server before loading the UI.

## [2.8.0] - 2026-07-31

### Added
- **Workspaces**: Switch between named workspaces with their own log directories and virtual folders.
- **Virtual folders**: Collect arbitrary files into custom sidebar folders (icons and colors supported).
- **Directory icons and colors**: Assign icons and accent colors to directory tabs; custom colors via an in-app HSV/hex picker.
- **Markdown viewer**: Open `.md` / `.markdown` files with editor + live preview, Mermaid diagrams, and save support.
- **Markdown PDF export**: Export the rendered preview to PDF (always light mode), with progress feedback.
- **Persisted workspace tabs**: Open tabs for the active workspace are restored when switching workspaces or restarting; standalone files stay open across workspace switches.

### Fixed
- **PDF export hang**: Export no longer stalls on remote font/CDN requests while loading the print preview.

## [2.7.1] - 2026-07-23

### Fixed
- **Filter scroll jump**: Filtering by log level or namespace no longer jumps to the start of the file. The view stays anchored on the previously visible line when it still matches, otherwise on the nearest matching entry.

## [2.7.0] - 2026-06-29

### Added
- **Notepad++-style search with configurable hotkeys**: Search shortcuts (open search, next/previous match, show all matches) can be customized in Settings → Tools & Editors.
- **"Show all matches" result panel**: Displays all search hits with line numbers in a resizable bottom pane, similar to Notepad++.
- **Sidebar file context menu**: Right-click a file to *Show in Explorer* or *Open in Editor* (system default application).
- **Resizable search result pane**: Drag the splitter to adjust panel height; the size is persisted in local storage.

### Changed
- **Search performance for large files**: Debounced live search (250 ms), virtualized result list, and a cap of 5 000 matches to keep the UI responsive on very large logs.
- **Drag & drop accepts any file**: Removed the extension whitelist — all dropped files are opened; an error is shown only when reading actually fails.
- **Search hotkeys unified across viewers**: Log, JSON, and XML viewers share the same configurable hotkey system.

### Fixed
- **Sidebar context menu**: Menu now closes correctly on outside clicks and *Show in Explorer* works reliably via the main-process IPC handler.

## [2.6.0] - 2026-06-10

### Added
- **Namespace statistics in filter tree**: The namespace filter now shows real log-entry counts per namespace, including aggregated counts on parent nodes.

### Changed
- **Progressive sidebar file loading (newest → oldest)**: Large file directories are now loaded in batches and rendered incrementally, so the file list appears immediately and continues to fill in while scanning.
- **Streaming file-list IPC flow**: Added a dedicated streamed file-list loading path between main and renderer to improve responsiveness for very large directories.

### Fixed
- **Namespace count semantics**: Namespace tree counters now represent actual log-entry totals instead of only child node counts.

## [2.5.1] - 2026-05-27

### Added
- **Tree editing for empty XML leaf tags**: Empty leaf nodes in XML Tree view are now directly editable. Clicking an empty placeholder opens inline editing, and entering text creates a text node for the element.

### Changed
- **XML Tree value highlighting**: Value rendering in Tree view now uses stronger visual contrast and type-aware styling to improve readability of booleans, numbers, paths, and plain text values.
- **Tree inline editor sizing for long values**: The inline editor now adapts to content length and supports a much wider max width, making long file paths and config values easier to edit.
- **Fold controls in Raw XML editor**: Fold indicators are now positioned next to XML tags instead of in the line-number gutter, and folded lines are rendered in a cleaner collapsed form (`<Tag ...>`).

### Fixed
- **Raw XML folding no longer affects Tree structure**: Tree parsing now always uses the expanded XML source, so folded placeholders cannot alter the Tree view hierarchy.
- **Collapsed-line marker rendering**: Internal fold marker comments are no longer shown as technical text in Raw view and are rendered as a readable collapsed-tag representation.
- **Current-line highlight after fold/unfold**: The highlighted row now remains on a valid line after folding operations and correctly tracks the collapsed parent line.
- **Empty-tag click target visibility**: Editable empty values now have a larger, clearly highlighted clickable area for better usability.

## [2.5.0] - 2026-05-12

### Added
- **Multi-directory sidebar with vertical tab strip**: The sidebar now supports multiple watched log directories simultaneously. Each directory gets a vertical tab on the left edge of the sidebar. Clicking a tab switches the file list to that directory. The active tab is highlighted with an accent border.
- **Drag-to-reorder directory tabs**: Directory tabs in the sidebar can be reordered by dragging them up or down.
- **Right-click context menu on directory tabs**: Right-clicking a directory tab opens a context menu with *Close Folder* and *Rename* actions. Renaming gives the tab a custom display label.
- **Directory labels in Settings**: The *Log Source* settings tab shows each watched directory with a label input field, allowing custom display names to be set or changed from within Settings.
- **Auto-switch active directory tab**: When switching between open file tabs, the sidebar automatically activates the directory tab that contains the currently viewed file.
- **Open Folder button in sidebar header**: A dedicated folder-open button in the sidebar header adds a new directory to the sidebar without a `+` tab in the strip.
- **All text files shown in sidebar (binary detection)**: The sidebar now shows every text-based file in a watched directory, not just known extensions. Files are identified as text by checking for null bytes in the first 512 bytes of their content. Binary files (images, compiled files, etc.) are excluded.
- **Content-based viewer routing for XML and JSON**: Opening an `.xml` file or a JSON config file routes it to the correct viewer automatically. XML files and non-log JSON files open in the XML / JSON viewer; JSON files that are detected as structured log output open in the Log Viewer.
- **Ctrl+click multi-select adds to existing tab**: Ctrl-clicking files in the sidebar adds each file to the currently active tab instead of opening a new tab per click. The active tab's file set grows incrementally — only the final selection remains.
- **Date grouping only for files with a date in the filename**: Files whose name contains no recognisable date are listed without a date group header. The *Today* / *Yesterday* group is only shown when the extracted date actually matches today or yesterday.
- **Localized date group labels**: The *Today* and *Yesterday* group headers are translated in all five supported languages (English, German, Polish, Romanian, Spanish).
- **Locale-aware date formatting in sidebar**: Older date group headers (e.g. `12.05.2026`) are formatted using the active application language rather than a hardcoded German locale.
- **XML Viewer with Raw and Tree view**: LogStudio now opens `.xml` files (e.g. config files) directly. Each XML file opens in its own tab with an `XML` badge. The **Raw view** shows syntax-highlighted XML (tag names in green, attributes in orange/blue, comments in gray) with a full code editor: Tab key inserts 2 spaces, Enter auto-indents to the current line's level, and typing `>` after an opening tag automatically inserts the matching closing tag. The **Tree view** renders the XML as a modern collapsible node tree — element names, attribute pills, and inline text values are all shown. *Expand all / Collapse all* buttons control the entire tree at once. Changes can be saved with Ctrl+S or the Save button; unsaved changes are indicated by a `●` dot in the toolbar. Revert discards all edits.
- **XML file support in Open dialog and drag & drop**: The file open dialog now includes an *XML Files* filter. Dragging and dropping `.xml` files onto the window opens them directly.

### Fixed
- **Drag collision between tab reorder and file-drop overlay**: Dragging a directory tab no longer triggers the file-drop overlay. The app-level `dragover` handler now only activates the overlay when the dragged item is a file from the OS (checked via `dataTransfer.types.includes('Files')`).
- **Context menu obscured by sidebar backdrop-filter**: The directory tab context menu is now rendered via `ReactDOM.createPortal` into `document.body`, escaping the sidebar's `backdrop-filter` stacking context so it always appears above all other content.
- **Localization keys showing as raw strings**: Separated non-component exports (`LANGUAGE_LABELS`, `detectLanguage`) from `i18n/index.tsx` into a new `i18n/constants.ts` file. This resolves a Vite Fast Refresh incompatibility that caused the i18n context to reset to its default (identity) function, making translation keys like `sidebar.files`, `xml.viewRaw`, and `xml.viewTree` appear as literal strings instead of translated text.

## [2.4.1] - 2026-03-31

### Added
- **Multi-line JSON log format (`json-multiline`)**: LogStudio now recognises log files where each entry is a JSON object formatted across multiple lines (e.g. NLog JSON output). A bracket-matching extractor handles files that are not valid JSON arrays and recovers all objects individually. Supported field names cover both lower-case variants (`timestamp`, `level`, `source`, `message`) and NLog PascalCase variants (`TimeStamp`, `Level`, `LoggerName`, `Message`). The new format is auto-detected and listed as *JSON (Multi-line)* in the stats bar.

### Fixed
- **Expanded-row height uses `fullText`**: The height calculation for expanded log entries now always uses `fullText` (which includes all JSON fields) instead of the short `message`, so expanded rows are never clipped when extra fields are present.
- **Expand button shown for JSON entries with extra fields**: Entries whose `fullText` differs from `message` (e.g. JSON entries carrying `package`, `process`, `uri`, etc.) now correctly show the expand button even when the message alone is short.
- **Search covers all JSON fields**: The search index now includes `fullText` instead of just `message`, so searches find matches in any JSON field (e.g. namespace, URI, process name).
- **`json-ecs` parser improvements**: Handles single-line JSON lines that are preceded by a text prefix (e.g. `prefix | {...}`); recognises GELF's `short_message` field; falls back to `process`/`HOSTNAME` for the namespace when no logger field is set; preserves the complete pretty-printed JSON as `fullText` for the expanded view.

## [2.4.0] - 2026-03-27

### Added
- **Redesigned Settings panel with tabbed navigation**: The settings panel has been reorganised into four clearly separated sections — *General* (theme, language, font size, auto-refresh), *Log Source* (directory, subdirectory scanning, new-file watcher, enabled format check-boxes), *Parsing & Schema* (custom regex pattern), and *Tools & Editors* (editor order). The new layout uses a left navigation rail matching the mockup and eliminates the long, hard-to-navigate single-column scroll.
- **Log-Source tab – "Automatically include subdirectories"**: New checkbox to recursively scan subdirectories of the configured log folder so files nested in date- or service-subdirectories appear in the sidebar automatically.
- **Log-Source tab – "Detected Formats" checkboxes**: Individual format groups (Pattern / Application Logs, Log4j / Logback, JSON Logs, Key Value (logfmt), Syslog, Apache Access Logs, Custom DD.MM.YYYY) can be enabled or disabled. The Schema Detection panel on the right shows which formats are currently active.
- **Auto-detection of new log files in the directory**: The sidebar now automatically refreshes when files are added or removed in the configured log directory — no manual refresh needed. A directory watcher (chokidar) runs in the main process and notifies the renderer via IPC.
- **Intelligent log format auto-detection**: LogStudio now automatically detects the format of any opened log file without requiring manual regex configuration. Supported formats: Pipe-Separated (LogStudio default), Log4j / Logback, ISO Timestamp, JSON / ECS (Elasticsearch), Logfmt (Go / cloud-native), Syslog RFC 5424, Syslog RFC 3164, Apache / Nginx Combined Log, and custom German date format (`DD.MM.YYYY`). The detected format is shown as a badge in the stats bar (📋 Log4j / Logback). Low-confidence detections are highlighted in amber/orange. Auto-detection can be toggled off in Settings to fall back to the custom regex schema. Multi-line entries (stack traces, indented continuations) are grouped correctly for all formats.
- **Search: highlight & navigate instead of filter-first**: Typing in the search field now highlights all matches inline (message and namespace columns) and jumps to the first occurrence instead of immediately filtering the list. A match counter (`2 of 47`) is shown next to the input. Arrow buttons (↑ / ↓) and Shift+Enter / Enter navigate between matches. The active match gets a distinct orange highlight; all other matches are subtly highlighted in yellow. An **"Apply as filter"** button toggles the previous filter behaviour — when active the list is filtered and the badge in the stats bar appears as before.

## [2.3.0] - 2026-03-24

### Added
- **Multilingual UI (i18n)**: Full internationalization support with five languages — English, German, Polish, Romanian, and Spanish. The application language is automatically detected from the system locale and can be overridden in the Settings panel.
- **Language selector in Settings**: A new Language dropdown in the Settings panel lets users choose their preferred language at any time.
- **Open File / Open Folder buttons in Sidebar**: The file-open and folder-open actions are now accessible directly in the sidebar header, alongside the existing directory files list. An icon-only "Open all files of the day" button is also shown per day group.
- **PNG icon set for open actions**: Sidebar action buttons use PNG icons (Open File, Open Folder, Open All from Day) styled to match the application theme.
- **Visual separator between button groups**: A subtle vertical separator divides the open-action buttons from navigation controls in the sidebar header.

### Changed
- **All UI strings localized**: Every user-visible string in the application — including log viewer toolbar labels (Entries, Reset, Tracking, End, column headers), copy button, context menu items (Copy entry, Open in editor), settings labels, about panel text, and sidebar messages — is now served through the i18n system.
- **DevTools no longer open automatically**: The Chromium DevTools are no longer opened on application start in development mode. F12 and Ctrl+Shift+I still work for manual access.

### Fixed
- **TypeScript `ToolbarProps` interface cleanup**: Removed leftover TitleBar-related props (`onSettingsClick`, `onAboutClick`, `onOpenFile`, `onThemeToggle`, etc.) from the Toolbar component interface, which were never actually used by the Toolbar.
- **`boolean | null` type mismatch on `isVisible` prop**: The `NamespaceToolbar` visibility expression now correctly evaluates to a strict `boolean`.
- **`TranslationKeys` type incompatibility**: The exported `TranslationKeys` type now uses a recursive `DeepString<T>` utility type, allowing translation files for non-English languages to satisfy the structural contract without requiring identical literal string values.

## [2.2.1] - 2026-03-19

### Added
- **"Copied to clipboard" toast**: A brief toast notification now appears when a log entry is copied via the Copy button or the right-click context menu
- **Drag overlay dismiss**: The drag-and-drop overlay can now be dismissed by pressing ESC or clicking anywhere on it — prevents it from getting stuck when a drag is canceled outside the window

### Fixed
- **Expanded row height on open**: The expand animation no longer uses `max-height` animation which caused the DOM measurement to capture an intermediate (too small) height. Height is now computed purely from CSS metrics at expand time — no scroll jump, no second resize after opening
- **Scroll jump when expanding rows**: Expanding a row that is above the visible viewport no longer shifts the view; scroll position is compensated by the exact delta
- **Log entries with empty message merged into previous**: Log lines whose message field is blank (e.g. `namespace |  `) were not matched by the parser regex and were incorrectly appended as continuations of the previous entry. Fixed by allowing empty message capture (`.*` instead of `.+`)
- **Blank line between entries treated as multi-line content**: A blank line between two normal log entries is now ignored instead of marking the first entry as multi-line
- **Drag overlay stuck on screen**: Overlay remaining visible after canceling a drag can now be closed with ESC or a click

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

[Unreleased]: https://github.com/DrScince/LogStudio/compare/v2.2.1...HEAD
[2.2.1]: https://github.com/DrScince/LogStudio/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/DrScince/LogStudio/compare/v2.1.5...v2.2.0
[1.3.0]: https://github.com/DrScince/LogStudio/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/yourusername/LogStudio/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/yourusername/LogStudio/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/yourusername/LogStudio/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/yourusername/LogStudio/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/yourusername/LogStudio/releases/tag/v1.0.0
