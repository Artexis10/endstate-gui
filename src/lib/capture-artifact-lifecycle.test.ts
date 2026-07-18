import { describe, expect, it } from 'vitest';
import { shouldDeleteCaptureArtifact } from './capture-artifact-lifecycle';

describe('capture artifact lifecycle', () => {
  it('retains production ZIP output for the completed SaveFlow result', () => {
    expect(shouldDeleteCaptureArtifact(false, 'zip')).toBe(false);
    expect(shouldDeleteCaptureArtifact(false, 'jsonc')).toBe(true);
    expect(shouldDeleteCaptureArtifact(true, 'jsonc')).toBe(false);
  });
});
