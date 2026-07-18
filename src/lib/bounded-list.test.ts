import { describe, expect, it } from 'vitest';
import { pushBounded } from './bounded-list';

describe('pushBounded', () => {
  it('keeps the newest entries without allowing the backing list to grow', () => {
    const entries = [1, 2];

    pushBounded(entries, 3, 2);
    pushBounded(entries, 4, 2);

    expect(entries).toEqual([3, 4]);
    expect(entries).toHaveLength(2);
  });
});
