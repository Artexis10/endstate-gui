import { describe, expect, it } from 'vitest';
import { buildRestoreTargetArgs } from './config-restore';

describe('buildRestoreTargetArgs', () => {
  it('emits one repeated flag for each explicit mapping', () => {
    expect(buildRestoreTargetArgs([
      { captureId: 'preferences-2024', targetInstanceId: 'photoshop-2024' },
      { captureId: 'presets-2025', targetInstanceId: 'photoshop-2025' },
    ])).toEqual([
      '--restore-target',
      'preferences-2024=photoshop-2024',
      '--restore-target',
      'presets-2025=photoshop-2025',
    ]);
  });

  it('emits no argument for an untouched mapping collection', () => {
    expect(buildRestoreTargetArgs([])).toEqual([]);
  });
});
