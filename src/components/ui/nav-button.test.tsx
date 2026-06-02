import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/test-utils';
import { NavButton } from './nav-button';

describe('NavButton', () => {
  it('renders its children as a button', () => {
    renderWithProviders(<NavButton onClick={() => {}}>Back</NavButton>);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('defaults type to "button"', () => {
    renderWithProviders(<NavButton>Back</NavButton>);
    expect(screen.getByRole('button', { name: 'Back' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('applies the muted nav styling and merges className', () => {
    renderWithProviders(<NavButton className="mb-6">Back</NavButton>);
    const btn = screen.getByRole('button', { name: 'Back' });
    expect(btn).toHaveClass('text-muted-foreground');
    expect(btn).toHaveClass('mb-6');
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    renderWithProviders(<NavButton onClick={onClick}>Back</NavButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    renderWithProviders(
      <NavButton disabled onClick={onClick}>
        Back
      </NavButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
