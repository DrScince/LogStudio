#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  buildLogFileExcerpt,
  formatMatches,
  listErrors,
  listFatalErrors,
  readLineRange,
  searchLog,
  splitLogLines,
} from './logUtils.js';
import { getFileInfo, readFileLimited, resolveReadablePath } from './pathGuard.js';

const filePathSchema = z
  .string()
  .min(1)
  .describe('Absolute or workspace-relative path to a log file on disk');

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

function createServer(): McpServer {
  const server = new McpServer({
    name: 'logstudio',
    version: '0.1.0',
  });

  server.tool(
    'get_log_info',
    'Return metadata for a log file (size, line count, modified time).',
    { filePath: filePathSchema },
    async ({ filePath }) => {
      try {
        const resolved = resolveReadablePath(filePath);
        const info = getFileInfo(resolved);
        const content = readFileLimited(resolved, 1024 * 1024);
        const totalLines = splitLogLines(content).length;
        return textResult(
          JSON.stringify(
            {
              ...info,
              lineCountSampled: totalLines,
              note:
                info.sizeBytes > 1024 * 1024
                  ? 'Line count sampled from first 1 MB only for very large files.'
                  : undefined,
            },
            null,
            2
          )
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  server.tool(
    'read_log_file',
    'Read a log file or a line range. Full reads are limited to 64 MB; use get_log_excerpt for large files.',
    {
      filePath: filePathSchema,
      startLine: z.number().int().min(1).optional().describe('First line to read (1-based)'),
      endLine: z.number().int().min(1).optional().describe('Last line to read (1-based, inclusive)'),
    },
    async ({ filePath, startLine, endLine }) => {
      try {
        const resolved = resolveReadablePath(filePath);
        const content = readFileLimited(resolved);
        if (startLine != null || endLine != null) {
          const start = startLine ?? 1;
          const end = endLine ?? splitLogLines(content).length;
          const { lines, totalLines } = readLineRange(content, start, end);
          return textResult(
            `Total lines: ${totalLines}\nShowing ${start}–${end}\n\n${formatMatches(lines)}`
          );
        }
        return textResult(content);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  server.tool(
    'get_log_excerpt',
    'Return a smart excerpt prioritizing ERROR/WARN/FATAL lines and file head/tail — ideal for large logs.',
    {
      filePath: filePathSchema,
      maxChars: z
        .number()
        .int()
        .min(1000)
        .max(120000)
        .optional()
        .describe('Maximum characters in the excerpt (default 28000)'),
    },
    async ({ filePath, maxChars }) => {
      try {
        const resolved = resolveReadablePath(filePath);
        const content = readFileLimited(resolved, 256 * 1024 * 1024);
        const result = buildLogFileExcerpt(content, maxChars ?? 28000);
        const header = [
          `File: ${resolved}`,
          `Total lines: ${result.totalLines}`,
          `Excerpt lines: ${result.lineCount}`,
          `Truncated: ${result.truncated}`,
          '',
        ].join('\n');
        return textResult(`${header}${result.excerpt}`);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  server.tool(
    'list_errors',
    'List ERROR/WARN/EXCEPTION and similar lines without using an LLM.',
    {
      filePath: filePathSchema,
      maxResults: z.number().int().min(1).max(500).optional(),
      contextLines: z.number().int().min(0).max(5).optional(),
    },
    async ({ filePath, maxResults, contextLines }) => {
      try {
        const resolved = resolveReadablePath(filePath);
        const content = readFileLimited(resolved, 256 * 1024 * 1024);
        const matches = listErrors(content, maxResults ?? 200, contextLines ?? 0);
        const header = `Found ${matches.length} line(s) in ${resolved}\n\n`;
        return textResult(header + formatMatches(matches));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  server.tool(
    'list_fatal_errors',
    'List FATAL/CRITICAL/PANIC lines only.',
    {
      filePath: filePathSchema,
      maxResults: z.number().int().min(1).max(500).optional(),
      contextLines: z.number().int().min(0).max(5).optional(),
    },
    async ({ filePath, maxResults, contextLines }) => {
      try {
        const resolved = resolveReadablePath(filePath);
        const content = readFileLimited(resolved, 256 * 1024 * 1024);
        const matches = listFatalErrors(content, maxResults ?? 200, contextLines ?? 0);
        const header = `Found ${matches.length} fatal line(s) in ${resolved}\n\n`;
        return textResult(header + formatMatches(matches));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  server.tool(
    'search_log',
    'Search a log file by plain text or regex.',
    {
      filePath: filePathSchema,
      query: z.string().min(1).describe('Search text or regex pattern'),
      regex: z.boolean().optional().describe('Treat query as regular expression'),
      caseSensitive: z.boolean().optional(),
      maxResults: z.number().int().min(1).max(500).optional(),
    },
    async ({ filePath, query, regex, caseSensitive, maxResults }) => {
      try {
        const resolved = resolveReadablePath(filePath);
        const content = readFileLimited(resolved, 256 * 1024 * 1024);
        const matches = searchLog(content, query, {
          regex: regex ?? false,
          caseSensitive: caseSensitive ?? false,
          maxResults: maxResults ?? 200,
        });
        const header = `Found ${matches.length} match(es) for "${query}" in ${resolved}\n\n`;
        return textResult(header + formatMatches(matches));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('LogStudio MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error in LogStudio MCP server:', err);
  process.exit(1);
});
