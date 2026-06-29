import React from 'react';
import { LogEntry } from '../types/log';

export const MAX_SEARCH_MATCHES = 5000;

export interface SearchMatch {
  id: number;
  entryIndex: number;
  lineNumber: number;
  column: number;
  preview: string;
}

export interface SearchMatchResult {
  matches: SearchMatch[];
  totalFound: number;
  truncated: boolean;
}

function buildPreviewText(entry: LogEntry): string {
  return entry.fullText || entry.message;
}

function entryHaystack(entry: LogEntry): string {
  return `${entry.fullText} ${entry.namespace} ${entry.timestamp} ${entry.level}`.toLowerCase();
}

/** Fast check: which entry indices contain the query (one pass, no match objects). */
export function findMatchingEntryIndices(entries: LogEntry[], query: string): Set<number> {
  const trimmed = query.trim();
  if (!trimmed) return new Set();

  const q = trimmed.toLowerCase();
  const indices = new Set<number>();
  for (let i = 0; i < entries.length; i++) {
    if (entryHaystack(entries[i]).includes(q)) {
      indices.add(i);
    }
  }
  return indices;
}

export function findSearchMatches(entries: LogEntry[], query: string): SearchMatchResult {
  const trimmed = query.trim();
  if (!trimmed) return { matches: [], totalFound: 0, truncated: false };

  const q = trimmed.toLowerCase();
  const qLen = q.length;
  const matches: SearchMatch[] = [];
  let totalFound = 0;
  let id = 0;

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    const entry = entries[entryIndex];
    if (!entryHaystack(entry).includes(q)) continue;

    const preview = buildPreviewText(entry);
    const previewLower = preview.toLowerCase();
    let pos = 0;

    while ((pos = previewLower.indexOf(q, pos)) !== -1) {
      totalFound++;
      if (matches.length < MAX_SEARCH_MATCHES) {
        matches.push({
          id: id++,
          entryIndex,
          lineNumber: entry.sourceLineNumber ?? entry.originalLineNumber,
          column: pos,
          preview,
        });
      }
      pos += qLen;
    }

    // Match in metadata fields not present in preview (namespace/timestamp/level only)
    if (previewLower.indexOf(q) === -1) {
      totalFound++;
      if (matches.length < MAX_SEARCH_MATCHES) {
        matches.push({
          id: id++,
          entryIndex,
          lineNumber: entry.sourceLineNumber ?? entry.originalLineNumber,
          column: 0,
          preview,
        });
      }
    }
  }

  return {
    matches,
    totalFound,
    truncated: totalFound > MAX_SEARCH_MATCHES,
  };
}

export function highlightSearchText(
  text: string,
  query: string,
  activeOccurrence?: number,
): React.ReactNode {
  if (!query.trim()) return text;

  const q = query;
  const qLower = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;
  let occurrence = 0;

  while (remaining.length > 0) {
    const idx = remaining.toLowerCase().indexOf(qLower);
    if (idx === -1) {
      parts.push(remaining);
      break;
    }
    if (idx > 0) parts.push(remaining.slice(0, idx));
    const isActive = activeOccurrence === occurrence;
    parts.push(
      <mark
        key={keyIdx++}
        className={`search-highlight${isActive ? ' search-highlight-active' : ''} search-results-highlight`}
      >
        {remaining.slice(idx, idx + q.length)}
      </mark>,
    );
    remaining = remaining.slice(idx + q.length);
    occurrence++;
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}
