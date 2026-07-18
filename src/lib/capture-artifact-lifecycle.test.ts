import { describe, expect, it } from 'vitest';
import { shouldDeleteCaptureArtifact } from './capture-artifact-lifecycle';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('capture artifact lifecycle', () => {
  it('retains production ZIP output for the completed SaveFlow result', () => {
    expect(shouldDeleteCaptureArtifact(false, 'zip')).toBe(false);
    expect(shouldDeleteCaptureArtifact(false, 'jsonc')).toBe(true);
    expect(shouldDeleteCaptureArtifact(true, 'jsonc')).toBe(false);
  });

  it('guards the production App delete_file_silent boundary with ZIP-aware lifecycle policy', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const captureCleanup = appSource.slice(
      appSource.indexOf('// Preserve ZIP bundles'),
      appSource.indexOf('return {', appSource.indexOf('// Preserve ZIP bundles')),
    );

    expect(captureCleanup).toContain(
      'if (shouldDeleteCaptureArtifact(import.meta.env.DEV, envelopeData?.outputFormat))',
    );
    expect(captureCleanup).toContain("await invoke('delete_file_silent', { path: outputPath })");
    expect(shouldDeleteCaptureArtifact(false, 'zip')).toBe(false);
  });
});
