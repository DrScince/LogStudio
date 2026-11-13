# AGENTS.md

## Cursor Cloud specific instructions

LogStudio is a self-contained **Electron desktop app** (Electron main process + React/Vite renderer). There is no backend, database, or external service — it reads local log files. Standard scripts live in `package.json`; the README documents features and usage. Node 20.x is used in CI; the cloud VM ships a newer Node which also works.

Non-obvious caveats for running/testing in the cloud VM:

- **Running the GUI is headless.** A virtual display is available at `DISPLAY=:1` (and `xvfb-run` exists as a fallback). Electron must be launched with `--no-sandbox` in this container, otherwise the Chromium sandbox fails to start.
- **Dev workflow.** `npm run dev` runs the Vite renderer (port 5173) and the Electron main process together. In headless mode, prefer starting them separately so you can inject flags: run `npm run dev:renderer` first, then `npm run build:main && DISPLAY=:1 npx electron . --dev --no-sandbox`. The `--dev` flag makes the main process load the renderer from `http://localhost:5173`.
- **Opening a log file without the native dialog.** The native file picker (`GtkFileChooserNative`) does not work reliably headlessly. Instead, pass a log file path as a CLI argument — `npx electron . /path/to/file.log --dev --no-sandbox` — which opens it directly via the main process (`openFileInRenderer`). A running instance is single-instance, so re-invoking with a path opens it in the existing window.
- **Default log format.** LogStudio parses `YYYY-MM-DD HH:mm:ss.SSS | LEVEL | NAMESPACE | MESSAGE` by default (pipe-separated). Use this format for sample/test logs.
- **Harmless noise.** `dconf-WARNING`, `Failed to connect to the bus`, GPU/`viz_main_impl`/swiftshader, and `GtkFileChooserNative` messages are expected in this headless environment and do not indicate a real failure.
- **Tests / lint.** `npm test` runs Vitest in watch mode; use `npm test -- --run` for a single run (as CI does). There is **no** `lint` script configured — the CI lint step is intentionally a no-op, so do not expect linting to run.
