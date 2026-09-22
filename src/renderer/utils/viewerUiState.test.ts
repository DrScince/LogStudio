import { describe, expect, it } from 'vitest';
import { resolveStructuredDisplayMode } from './viewerUiState';

describe('resolveStructuredDisplayMode', () => {
  it('keeps raw when requested', () => {
    expect(resolveStructuredDisplayMode('raw', false)).toBe('raw');
    expect(resolveStructuredDisplayMode('raw', true)).toBe('raw');
  });

  it('keeps tree when parse succeeds', () => {
    expect(resolveStructuredDisplayMode('tree', false)).toBe('tree');
  });

  it('falls back to raw when tree parse fails', () => {
    expect(resolveStructuredDisplayMode('tree', true)).toBe('raw');
  });
});
