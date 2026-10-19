import { describe, expect, it } from 'vitest';
import { settingsKind, settingsModulesPhrase } from './settings-kind';

describe('settings-kind', () => {
  it('never counts a module of an unknown tier as an app, and counts an ID without a tier as one', () => {
    expect(settingsKind('future-tier.display')).toBe('other');
    expect(settingsKind('vscode')).toBe('app');

    expect(
      settingsModulesPhrase(['apps.git', 'vscode', 'windows-settings.keyboard', 'future-tier.display']),
    ).toBe('2 app settings, 1 Windows setting and 1 other setting');
  });
});
