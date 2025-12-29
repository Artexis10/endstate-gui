import { describe, it, expect } from 'vitest';
import { pluralize, formatCount } from './pluralize';

describe('pluralize', () => {
  it('returns singular form for count of 1', () => {
    expect(pluralize(1, 'app')).toBe('app');
    expect(pluralize(1, 'item')).toBe('item');
  });

  it('returns plural form for count of 0', () => {
    expect(pluralize(0, 'app')).toBe('apps');
    expect(pluralize(0, 'item')).toBe('items');
  });

  it('returns plural form for count greater than 1', () => {
    expect(pluralize(2, 'app')).toBe('apps');
    expect(pluralize(5, 'app')).toBe('apps');
    expect(pluralize(100, 'item')).toBe('items');
  });

  it('uses custom plural form when provided', () => {
    expect(pluralize(2, 'entry', 'entries')).toBe('entries');
    expect(pluralize(1, 'entry', 'entries')).toBe('entry');
    expect(pluralize(0, 'entry', 'entries')).toBe('entries');
  });
});

describe('formatCount', () => {
  it('formats count with singular form for 1', () => {
    expect(formatCount(1, 'app')).toBe('1 app');
    expect(formatCount(1, 'item')).toBe('1 item');
  });

  it('formats count with plural form for 0', () => {
    expect(formatCount(0, 'app')).toBe('0 apps');
    expect(formatCount(0, 'item')).toBe('0 items');
  });

  it('formats count with plural form for multiple', () => {
    expect(formatCount(2, 'app')).toBe('2 apps');
    expect(formatCount(5, 'app')).toBe('5 apps');
    expect(formatCount(100, 'item')).toBe('100 items');
  });

  it('formats count with custom plural form', () => {
    expect(formatCount(2, 'entry', 'entries')).toBe('2 entries');
    expect(formatCount(1, 'entry', 'entries')).toBe('1 entry');
  });
});
