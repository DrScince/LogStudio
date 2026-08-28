# LogStudio MCP Server

Standalone [Model Context Protocol](https://modelcontextprotocol.io/) server that exposes log-file tools to **GitHub Copilot** in **VS Code** or **Visual Studio** — without running a local 7B LLM inside LogStudio.

Use this when you already have Copilot and want lightweight log analysis (`list_fatal_errors`, `search_log`, smart excerpts) from the IDE agent.

## Tools

| Tool | Description |
|------|-------------|
| `get_log_info` | File size, modified time, approximate line count |
| `read_log_file` | Read full file (≤64 MB) or a line range |
| `get_log_excerpt` | Error/warn-biased excerpt for large logs |
| `list_errors` | ERROR/WARN/EXCEPTION lines (no LLM) |
| `list_fatal_errors` | FATAL/CRITICAL/PANIC only |
| `search_log` | Plain text or regex search |

## Quick start

```bash
cd packages/logstudio-mcp
npm install
npm run build
npm test
```

Run manually (stdio):

```bash
node dist/index.js
```

## VS Code (Copilot Agent)

1. Build the server (`npm run build` in this folder).
2. Copy `examples/vscode-mcp.json` to your project as `.vscode/mcp.json` (or merge into user settings).
3. Adjust the path if your repo layout differs.
4. Open Copilot Chat → **Agent** mode — LogStudio tools appear automatically.

Example `.vscode/mcp.json`:

```json
{
  "servers": {
    "logstudio": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/packages/logstudio-mcp/dist/index.js"],
      "env": {
        "LOGSTUDIO_MCP_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

**Tip:** Ask Copilot e.g. *"Use list_fatal_errors on logs/app.log"* or *"Search app.log for ECONNREFUSED"*.

## Visual Studio 2022 (17.14+)

1. Build the server.
2. Place `.mcp.json` in your solution folder (see `examples/visualstudio-mcp.json`).
3. Enable Copilot Agent mode and select the LogStudio MCP server.

## Security: `LOGSTUDIO_MCP_ROOT`

When set, the server only reads files **under** that directory. Recommended for IDE use:

```json
"env": { "LOGSTUDIO_MCP_ROOT": "${workspaceFolder}" }
```

Omit the variable to allow any path the Copilot user can reference (less safe).

## Relationship to LogStudio app

- The **Electron app** can still use the built-in **Ollama** chat (offline, no Copilot subscription).
- This MCP server is an **additional** path for developers who prefer Copilot in the IDE.
- Log excerpt logic mirrors `src/renderer/utils/aiLogContext.ts`.

## Development

```bash
npm run dev    # tsx src/index.ts
npm run test   # vitest
```

Test with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
