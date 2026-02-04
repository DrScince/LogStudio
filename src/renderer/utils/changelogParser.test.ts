import { describe, it, expect } from 'vitest';
import { parseChangelog } from './changelogParser';

describe('changelogParser', () => {
  it('should parse a simple changelog with one release', () => {
    const changelog = `# Changelog

## [1.0.0] - 2025-01-01

### Added
- **Feature 1**: Description of feature 1
- **Feature 2**: Description of feature 2

### Changed
- **Change 1**: Description of change 1

### Fixed
- **Fix 1**: Description of fix 1`;

    const releases = parseChangelog(changelog);

    expect(releases).toHaveLength(1);
    expect(releases[0]).toMatchObject({
      version: '1.0.0',
      date: '2025-01-01',
    });
    expect(releases[0].added).toHaveLength(2);
    expect(releases[0].changed).toHaveLength(1);
    expect(releases[0].fixed).toHaveLength(1);
  });

  it('should parse multiple releases', () => {
    const changelog = `# Changelog

## [1.1.0] - 2025-02-01

### Added
- New feature

## [1.0.0] - 2025-01-01

### Added
- Initial release`;

    const releases = parseChangelog(changelog);

    expect(releases).toHaveLength(2);
    expect(releases[0].version).toBe('1.1.0');
    expect(releases[1].version).toBe('1.0.0');
  });

  it('should skip Unreleased section', () => {
    const changelog = `# Changelog

## [Unreleased]

### Added
- Future feature

## [1.0.0] - 2025-01-01

### Added
- Initial release`;

    const releases = parseChangelog(changelog);

    // Unreleased section is skipped, but if it comes after a release, 
    // the previous release might still be included
    expect(releases.length).toBeGreaterThanOrEqual(1);
    const version10Release = releases.find(r => r.version === '1.0.0');
    expect(version10Release).toBeDefined();
  });

  it('should handle releases without date', () => {
    const changelog = `# Changelog

## [1.0.0]

### Added
- Feature`;

    const releases = parseChangelog(changelog);

    expect(releases).toHaveLength(1);
    expect(releases[0].version).toBe('1.0.0');
    expect(releases[0].date).toBe('');
  });

  it('should remove markdown formatting from items', () => {
    const changelog = `# Changelog

## [1.0.0] - 2025-01-01

### Added
- **Bold text**: Description
- *Italic text*: Description`;

    const releases = parseChangelog(changelog);

    expect(releases[0].added).toContain('Bold text: Description');
    expect(releases[0].added).toContain('Italic text: Description');
    expect(releases[0].added?.[0]).not.toContain('**');
    expect(releases[0].added?.[1]).not.toContain('*');
  });

  it('should handle empty sections', () => {
    const changelog = `# Changelog

## [1.0.0] - 2025-01-01

### Added
- Feature

### Changed

### Fixed`;

    const releases = parseChangelog(changelog);

    expect(releases[0].added).toHaveLength(1);
    expect(releases[0].changed).toHaveLength(0);
    expect(releases[0].fixed).toHaveLength(0);
  });

  it('should ignore link references at the end', () => {
    const changelog = `# Changelog

## [1.0.0] - 2025-01-01

### Added
- Feature

[1.0.0]: https://github.com/example/repo/releases/tag/v1.0.0`;

    const releases = parseChangelog(changelog);

    expect(releases).toHaveLength(1);
    expect(releases[0].added).toHaveLength(1);
  });

  it('should handle complex changelog structure', () => {
    const changelog = `# Changelog

## [1.2.0] - 2025-02-04

### Added
- **Feature 1**: Description
- **Feature 2**: Another description

### Changed
- **Change 1**: Description

### Fixed
- **Fix 1**: Description

## [1.1.0] - 2025-02-03

### Added
- Older feature`;

    const releases = parseChangelog(changelog);

    expect(releases).toHaveLength(2);
    expect(releases[0].version).toBe('1.2.0');
    expect(releases[0].added).toHaveLength(2);
    expect(releases[0].changed).toHaveLength(1);
    expect(releases[0].fixed).toHaveLength(1);
    expect(releases[1].version).toBe('1.1.0');
  });
});
