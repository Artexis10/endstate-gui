/**
 * Engine Path Resolution Tests
 * 
 * Tests for CLI path resolution order (INV-CAPTURE):
 * 1. User-configured path (if exists)
 * 2. <repoRoot>\bin\endstate.ps1 (preferred)
 * 3. <repoRoot>\bin\endstate.cmd (fallback)
 * 4. Legacy <repoRoot>\endstate.ps1 (migration only)
 */

import { describe, it, expect } from 'vitest';
import { getMigratedPath, getRepoRootFromScriptPath } from './engine-path';

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
