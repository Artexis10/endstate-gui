import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/test-utils';
import { FilterChip } from './filter-chip';

describe('FilterChip', () => {
  it('reflects the pressed state via aria-pressed', () => {
    renderWithProviders(
      <FilterChip pressed onClick={() => {}}>
        5 apps
      </FilterChip>,
    );
    expect(screen.getByRole('button', { name: '5 apps' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('is not pressed when pressed is false', () => {
    renderWithProviders(
      <FilterChip pressed={false} onClick={() => {}}>
        5 apps
      </FilterChip>,
    );
    expect(screen.getByRole('button', { name: '5 apps' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('dims to opacity-50 when dimmed', () => {
    renderWithProviders(
      <FilterChip pressed={false} dimmed onClick={() => {}}>
        x
      </FilterChip>,
    );
    expect(screen.getByRole('button', { name: 'x' })).toHaveClass('opacity-50');
  });

  it('merges the caller-supplied color className', () => {
    renderWithProviders(
      <FilterChip pressed className="bg-teal-500/10 text-teal-400" onClick={() => {}}>
        x
      </FilterChip>,
    );
    const chip = screen.getByRole('button', { name: 'x' });
    expect(chip).toHaveClass('bg-teal-500/10');
    expect(chip).toHaveClass('text-teal-400');
  });

  it('fires onClick when activated', () => {
    const onClick = vi.fn();
    renderWithProviders(
      <FilterChip pressed onClick={onClick}>
        x
      </FilterChip>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'x' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
