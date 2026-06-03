import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/test-utils';
import { DisclosureButton } from './disclosure-button';

describe('DisclosureButton', () => {
  it('renders its children as a button', () => {
    renderWithProviders(<DisclosureButton>Live activity</DisclosureButton>);
    expect(screen.getByRole('button', { name: 'Live activity' })).toBeInTheDocument();
  });

  it('defaults type to "button"', () => {
    renderWithProviders(<DisclosureButton>Details</DisclosureButton>);
    expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute('type', 'button');
  });

  it('is full-width, muted, and carries a keyboard focus ring', () => {
    renderWithProviders(<DisclosureButton>Details</DisclosureButton>);
    const btn = screen.getByRole('button', { name: 'Details' });
    expect(btn).toHaveClass('w-full');
    expect(btn).toHaveClass('text-muted-foreground');
    expect(btn).toHaveClass('focus-visible:ring-2');
  });

  it('merges className (e.g. a denser text size)', () => {
    renderWithProviders(<DisclosureButton className="text-xs">Details</DisclosureButton>);
    expect(screen.getByRole('button', { name: 'Details' })).toHaveClass('text-xs');
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    renderWithProviders(<DisclosureButton onClick={onClick}>Details</DisclosureButton>);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    renderWithProviders(
      <DisclosureButton disabled onClick={onClick}>
        Details
      </DisclosureButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
