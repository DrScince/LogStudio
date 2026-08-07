/** Session-only UI state for structured viewers (XML/JSON) so tab switches keep mode + tree folds. */

export type StructuredViewMode = 'raw' | 'tree';

export interface StructuredViewerUiState {
  viewMode: StructuredViewMode;
  /** Paths of collapsed expandable nodes (e.g. "0/1/2"). Empty = all expanded. */
  collapsedPaths: string[];
}

const cache = new Map<string, StructuredViewerUiState>();

export function getStructuredViewerUi(tabId: string): StructuredViewerUiState | undefined {
  return cache.get(tabId);
}

export function setStructuredViewerUi(tabId: string, state: StructuredViewerUiState): void {
  cache.set(tabId, {
    viewMode: state.viewMode,
    collapsedPaths: [...state.collapsedPaths],
  });
}

export function clearStructuredViewerUi(tabId: string): void {
  cache.delete(tabId);
}

export function clearAllStructuredViewerUi(): void {
  cache.clear();
}

/** Drop cached UI for tabs that are no longer open. */
export function pruneStructuredViewerUi(keepTabIds: Iterable<string>): void {
  const keep = new Set(keepTabIds);
  for (const id of [...cache.keys()]) {
    if (!keep.has(id)) cache.delete(id);
  }
}

export function childNodeKey(parentKey: string, index: number): string {
  return parentKey === '' ? String(index) : `${parentKey}/${index}`;
}
