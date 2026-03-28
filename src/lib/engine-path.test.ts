/**
 * Engine Path Resolution Tests
 *
 * Tests for CLI path resolution order (INV-CAPTURE):
 * 1. User-configured path (if exists)
 * 2. <repoRoot>\bin\endstate.ps1 (preferred)
 * 3. <repoRoot>\bin\endstate.cmd (fallback)
 * 4. Legacy <repoRoot>\endstate.ps1 (migration only)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMigratedPath, getRepoRootFromScriptPath, fileExists, resolveEnginePath, validateEngineScriptPath } from './engine-path';

// Mock tauri-bridge
vi.mock('./tauri-bridge', () => ({
  invoke: vi.fn(),
  isEngineAvailable: vi.fn(() => true),
}));

import { invoke, isEngineAvailable } from './tauri-bridge';
const mockInvoke = vi.mocked(invoke);
const mockIsEngineAvailable = vi.mocked(isEngineAvailable);

describe('Engine Path Resolution', () => {
  describe('getMigratedPath', () => {
    it('migrates root-level endstate.ps1 to bin/endstate.ps1', () => {
      const oldPath = 'C:\\projects\\endstate\\endstate.ps1';
      const migrated = getMigratedPath(oldPath);
      expect(migrated).toBe('C:\\projects\\endstate\\bin\\endstate.ps1');
    });

    it('does NOT migrate paths already in bin/', () => {
      const binPath = 'C:\\projects\\endstate\\bin\\endstate.ps1';
      const migrated = getMigratedPath(binPath);
      expect(migrated).toBeNull();
    });

    it('handles forward slashes in path', () => {
      const oldPath = 'C:/projects/endstate/endstate.ps1';
      const migrated = getMigratedPath(oldPath);
      expect(migrated).toBe('C:\\projects\\endstate\\bin\\endstate.ps1');
    });

    it('returns null for non-endstate.ps1 paths', () => {
      const otherPath = 'C:\\projects\\endstate\\cli.ps1';
      const migrated = getMigratedPath(otherPath);
      expect(migrated).toBeNull();
    });
  });

  describe('getRepoRootFromScriptPath', () => {
    it('extracts repo root from bin/endstate.ps1 path', () => {
      const binPath = 'C:\\projects\\endstate\\bin\\endstate.ps1';
      const root = getRepoRootFromScriptPath(binPath);
      expect(root).toBe('C:\\projects\\endstate');
    });

    it('extracts repo root from bin/endstate.cmd path', () => {
      const cmdPath = 'C:\\projects\\endstate\\bin\\endstate.cmd';
      const root = getRepoRootFromScriptPath(cmdPath);
      expect(root).toBe('C:\\projects\\endstate');
    });

    it('extracts repo root from legacy root-level endstate.ps1', () => {
      const legacyPath = 'C:\\projects\\endstate\\endstate.ps1';
      const root = getRepoRootFromScriptPath(legacyPath);
      expect(root).toBe('C:\\projects\\endstate');
    });

    it('handles forward slashes', () => {
      const binPath = 'C:/projects/endstate/bin/endstate.ps1';
      const root = getRepoRootFromScriptPath(binPath);
      expect(root).toBe('C:\\projects\\endstate');
    });

    it('returns null for unrecognized paths', () => {
      const unknownPath = 'C:\\projects\\other\\script.ps1';
      const root = getRepoRootFromScriptPath(unknownPath);
      expect(root).toBeNull();
    });
  });

  describe('Path resolution order contract', () => {
    it('bin/endstate.ps1 is preferred over root-level endstate.ps1', () => {
      // Given a root-level path, migration should point to bin/
      const legacyPath = 'C:\\projects\\endstate\\endstate.ps1';
      const migrated = getMigratedPath(legacyPath);
      
      // The migrated path should be in bin/
      expect(migrated).toContain('\\bin\\');
      expect(migrated).toBe('C:\\projects\\endstate\\bin\\endstate.ps1');
    });

    it('can derive bin path from any recognized script path', () => {
      const testPaths = [
        'C:\\projects\\endstate\\endstate.ps1',
        'C:\\projects\\endstate\\bin\\endstate.ps1',
        'C:\\projects\\endstate\\bin\\endstate.cmd',
      ];

      for (const path of testPaths) {
        const root = getRepoRootFromScriptPath(path);
        expect(root).not.toBeNull();

        // From root, we can construct the preferred bin path
        const preferredPath = `${root}\\bin\\endstate.ps1`;
        expect(preferredPath).toBe('C:\\projects\\endstate\\bin\\endstate.ps1');
      }
    });
  });
});

describe('fileExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEngineAvailable.mockReturnValue(true);
  });

  it('returns true when invoke returns true', async () => {
    mockInvoke.mockResolvedValue(true);
    const result = await fileExists('C:\\some\\file.ps1');
    expect(result).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('check_file_exists', { path: 'C:\\some\\file.ps1' });
  });

  it('returns false when invoke returns false', async () => {
    mockInvoke.mockResolvedValue(false);
    const result = await fileExists('C:\\missing\\file.ps1');
    expect(result).toBe(false);
  });

  it('returns false in web mode (engine unavailable)', async () => {
    mockIsEngineAvailable.mockReturnValue(false);
    const result = await fileExists('C:\\any\\path.ps1');
    expect(result).toBe(false);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('returns false when invoke throws', async () => {
    mockInvoke.mockRejectedValue(new Error('IPC failure'));
    const result = await fileExists('C:\\some\\file.ps1');
    expect(result).toBe(false);
  });
});

describe('resolveEnginePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEngineAvailable.mockReturnValue(true);
  });

  it('returns user_config when configured path exists', async () => {
    mockInvoke.mockResolvedValue(true);

    const result = await resolveEnginePath('C:\\projects\\endstate\\bin\\endstate.ps1');

    expect(result.resolution).toBe('user_config');
    expect(result.path).toBe('C:\\projects\\endstate\\bin\\endstate.ps1');
    expect(result.migrated).toBe(false);
  });

  it('migrates root-level path to bin/ when bin path exists', async () => {
    // First call: configured path does not exist
    // Second call: migrated bin path exists
    mockInvoke
      .mockResolvedValueOnce(false)   // configured path check
      .mockResolvedValueOnce(true);   // migrated bin/ path check

    const result = await resolveEnginePath('C:\\projects\\endstate\\endstate.ps1');

    expect(result.resolution).toBe('bin_ps1');
    expect(result.path).toBe('C:\\projects\\endstate\\bin\\endstate.ps1');
    expect(result.migrated).toBe(true);
    expect(result.originalPath).toBe('C:\\projects\\endstate\\endstate.ps1');
  });

  it('falls back to bin/endstate.ps1 via repo root when migrated path does not exist', async () => {
    // Configured path: bin/endstate.ps1 doesn't exist
    // Migrated path: null (already in bin/)
    // Repo root bin/endstate.ps1 check: exists
    mockInvoke
      .mockResolvedValueOnce(false)   // configured path
      .mockResolvedValueOnce(true);   // bin/endstate.ps1 via repo root

    const result = await resolveEnginePath('C:\\projects\\endstate\\bin\\endstate.ps1');

    // Since path IS already in bin/ and configured path doesn't exist,
    // it goes through repo root resolution
    expect(result.resolution).toBe('bin_ps1');
    expect(result.path).toBe('C:\\projects\\endstate\\bin\\endstate.ps1');
  });

  it('falls back to bin/endstate.cmd when ps1 does not exist', async () => {
    // For a bin/endstate.ps1 configured path that doesn't exist:
    // 1. configured path check: false
    // 2. repo root bin/endstate.ps1 check: false
    // 3. repo root bin/endstate.cmd check: true
    mockInvoke
      .mockResolvedValueOnce(false)   // configured path
      .mockResolvedValueOnce(false)   // bin/endstate.ps1
      .mockResolvedValueOnce(true);   // bin/endstate.cmd

    const result = await resolveEnginePath('C:\\projects\\endstate\\bin\\endstate.ps1');

    expect(result.resolution).toBe('bin_cmd');
    expect(result.path).toBe('C:\\projects\\endstate\\bin\\endstate.cmd');
    expect(result.migrated).toBe(true);
  });

  it('returns invalid when no resolution path works', async () => {
    mockInvoke.mockResolvedValue(false);  // all file checks fail

    const result = await resolveEnginePath('C:\\projects\\endstate\\endstate.ps1');

    expect(result.resolution).toBe('invalid');
    expect(result.path).toBeNull();
    expect(result.migrated).toBe(false);
    expect(result.debugMessage).toContain('not found');
  });

  it('returns invalid for unrecognized path format when nothing exists', async () => {
    mockInvoke.mockResolvedValue(false);

    const result = await resolveEnginePath('C:\\random\\script.ps1');

    expect(result.resolution).toBe('invalid');
    expect(result.path).toBeNull();
  });
});

describe('validateEngineScriptPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEngineAvailable.mockReturnValue(true);
  });

  it('returns error when path is empty', async () => {
    const error = await validateEngineScriptPath('');
    expect(error).toBe('Engine script path is not configured');
  });

  it('returns null when file exists', async () => {
    mockInvoke.mockResolvedValue(true);
    const error = await validateEngineScriptPath('C:\\test\\endstate.ps1');
    expect(error).toBeNull();
  });

  it('returns error with bin suggestion when file does not exist and path is recognized', async () => {
    mockInvoke.mockResolvedValue(false);
    const error = await validateEngineScriptPath('C:\\projects\\endstate\\endstate.ps1');

    expect(error).not.toBeNull();
    expect(error).toContain('not found');
    expect(error).toContain('bin\\endstate.ps1');
  });

  it('returns simple error when file does not exist and path is not recognized', async () => {
    mockInvoke.mockResolvedValue(false);
    const error = await validateEngineScriptPath('C:\\random\\script.ps1');

    expect(error).not.toBeNull();
    expect(error).toContain('not found');
    expect(error).not.toContain('bin\\endstate.ps1');
  });

  it('returns error without bin suggestion when already pointing to bin path', async () => {
    mockInvoke.mockResolvedValue(false);
    const error = await validateEngineScriptPath('C:\\projects\\endstate\\bin\\endstate.ps1');

    expect(error).not.toBeNull();
    expect(error).toContain('not found');
    // Should not suggest same path
  });
});
