import { describe, expect, it } from 'vitest';

import type { CaptureConfigModule, CaptureWarning } from './types';

describe('CaptureConfigModule envelope evidence', () => {
  it('accepts optional module warnings and errors from the engine', () => {
    const module: CaptureConfigModule = {
      id: 'apps.partial',
      appId: 'partial',
      displayName: 'Partial',
      status: 'error',
      filesCaptured: 1,
      paths: ['configs/partial/settings.json'],
      warnings: ['optional value unavailable'],
      errors: ['required file unavailable'],
    };

    expect(module.warnings).toEqual(['optional value unavailable']);
    expect(module.errors).toEqual(['required file unavailable']);
    expect(module.paths).toEqual(['configs/partial/settings.json']);
  });

  it('accepts general warnings without package provenance', () => {
    const warning: CaptureWarning = {
      code: 'capture_warning',
      message: 'Capture completed with a general warning.',
    };

    expect(warning.code).toBe('capture_warning');
  });
});
