import { describe, it, expect } from 'vitest';

// Filter logic for Details modal
export function filterItemsByCategory(
  items: Array<{ reason?: string; status?: string }>,
  activeFilters: Set<string>
): Array<{ reason?: string; status?: string }> {
  if (activeFilters.size === 0) return items;
  
  return items.filter(item => {
    // Map item to category label
    let label = '';
    if (item.reason === 'would_install') {
      label = 'Will be installed';
    } else if (item.reason === 'installed') {
      label = 'Installed this run';
    } else if (item.reason === 'already_installed' || item.reason === 'already_present') {
      label = 'Already present';
    } else if (item.status === 'failed' || item.reason === 'failed' || item.reason === 'install_failed') {
      label = 'Needs attention';
    } else if (item.reason === 'skipped' || item.reason === 'filtered') {
      label = 'Skipped';
    }
    
    return activeFilters.has(label);
  });
}

describe('Filter Utils', () => {
  it('returns all items when no filters are active', () => {
    const items = [
      { reason: 'would_install', status: 'ok' },
      { reason: 'already_present', status: 'ok' },
      { reason: 'failed', status: 'failed' },
    ];
    const result = filterItemsByCategory(items, new Set());
    expect(result).toEqual(items);
  });

  it('filters items by "Will be installed" category', () => {
    const items = [
      { reason: 'would_install', status: 'ok' },
      { reason: 'already_present', status: 'ok' },
      { reason: 'failed', status: 'failed' },
    ];
    const result = filterItemsByCategory(items, new Set(['Will be installed']));
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('would_install');
  });

  it('filters items by "Already present" category', () => {
    const items = [
      { reason: 'would_install', status: 'ok' },
      { reason: 'already_present', status: 'ok' },
      { reason: 'already_installed', status: 'ok' },
      { reason: 'failed', status: 'failed' },
    ];
    const result = filterItemsByCategory(items, new Set(['Already present']));
    expect(result).toHaveLength(2);
    expect(result.every(i => i.reason === 'already_present' || i.reason === 'already_installed')).toBe(true);
  });

  it('filters items by "Needs attention" category', () => {
    const items = [
      { reason: 'would_install', status: 'ok' },
      { reason: 'already_present', status: 'ok' },
      { reason: 'failed', status: 'failed' },
      { reason: 'install_failed', status: 'failed' },
      { status: 'failed' },
    ];
    const result = filterItemsByCategory(items, new Set(['Needs attention']));
    expect(result).toHaveLength(3);
  });

  it('filters items by multiple categories', () => {
    const items = [
      { reason: 'would_install', status: 'ok' },
      { reason: 'already_present', status: 'ok' },
      { reason: 'failed', status: 'failed' },
      { reason: 'skipped', status: 'ok' },
    ];
    const result = filterItemsByCategory(items, new Set(['Will be installed', 'Skipped']));
    expect(result).toHaveLength(2);
    expect(result.some(i => i.reason === 'would_install')).toBe(true);
    expect(result.some(i => i.reason === 'skipped')).toBe(true);
  });

  it('returns empty array when no items match filters', () => {
    const items = [
      { reason: 'already_present', status: 'ok' },
      { reason: 'skipped', status: 'ok' },
    ];
    const result = filterItemsByCategory(items, new Set(['Will be installed']));
    expect(result).toHaveLength(0);
  });

  it('handles items with missing reason/status gracefully', () => {
    const items = [
      { reason: 'would_install', status: 'ok' },
      {},
      { reason: undefined, status: undefined },
    ];
    const result = filterItemsByCategory(items, new Set(['Will be installed']));
    expect(result).toHaveLength(1);
  });
});
