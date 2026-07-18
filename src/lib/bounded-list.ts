/** Append while retaining only the newest entries in the backing array. */
export function pushBounded<T>(items: T[], item: T, limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new RangeError('Bounded list limit must be a positive safe integer');
  }

  items.push(item);
  const overflow = items.length - limit;
  if (overflow > 0) {
    items.splice(0, overflow);
  }
}
