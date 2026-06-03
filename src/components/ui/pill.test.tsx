import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/test-utils';
import { Pill } from './pill';

describe('Pill', () => {
  it('renders its children as a button', () => {
    renderWithProviders(<Pill>Hosted Backup · Active</Pill>);
    expect(screen.getByRole('button', { name: 'Hosted Backup · Active' })).toBeInTheDocument();
  });

  it('defaults type to "button"', () => {
    renderWithProviders(<Pill>Active</Pill>);
    expect(screen.getByRole('button', { name: 'Active' })).toHaveAttribute('type', 'button');
  });

  it('is a rounded-full pill with a keyboard focus ring', () => {
    renderWithProviders(<Pill>Active</Pill>);
    const btn = screen.getByRole('button', { name: 'Active' });
    expect(btn).toHaveClass('rounded-full');
    expect(btn).toHaveClass('focus-visible:ring-2');
  });

  it('merges per-state colour className and forwards data-* attributes', () => {
    renderWithProviders(
      <Pill className="bg-primary/10 text-primary" data-state="active">
        Active
      </Pill>,
    );
    const btn = screen.getByRole('button', { name: 'Active' });
    expect(btn).toHaveClass('text-primary');
    expect(btn).toHaveAttribute('data-state', 'active');
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    renderWithProviders(<Pill onClick={onClick}>Active</Pill>);
    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
