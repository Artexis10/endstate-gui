import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { Button } from './button';

describe('Button', () => {
  describe('link variant', () => {
    it('renders an inline text link (no button box, normal weight)', () => {
      renderWithProviders(
        <Button variant="link" size="inline">
          Create an account
        </Button>,
      );
      const btn = screen.getByRole('button', { name: 'Create an account' });
      // Reads as a link, not a button: normal weight + underline-on-hover.
      expect(btn).toHaveClass('font-normal');
      expect(btn).toHaveClass('text-primary');
      expect(btn).toHaveClass('hover:underline');
      // `inline` size strips the box so it sits in flowing text.
      expect(btn).toHaveClass('h-auto');
      expect(btn).toHaveClass('p-0');
    });

    it('keeps the consistent focus ring from the Button base', () => {
      renderWithProviders(
        <Button variant="link" size="inline">
          link
        </Button>,
      );
      expect(screen.getByRole('button', { name: 'link' })).toHaveClass(
        'focus-visible:ring-2',
      );
    });

    it('lets className override the variant defaults (e.g. a heavier error CTA)', () => {
      renderWithProviders(
        <Button variant="link" size="inline" className="text-xs font-medium">
          Create an account →
        </Button>,
      );
      const btn = screen.getByRole('button', { name: 'Create an account →' });
      expect(btn).toHaveClass('text-xs');
      expect(btn).toHaveClass('font-medium');
    });
  });
});
