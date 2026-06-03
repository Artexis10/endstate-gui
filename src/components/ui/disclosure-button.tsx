import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DisclosureButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * Full-width header for a collapsible section ("disclosure"). The standardized
 * primitive for the expand/collapse rows that sit above streaming logs, app
 * lists, and detail panels.
 *
 * It is deliberately light (no chunky button box) — over the previous
 * hand-rolled markup it adds: soft `rounded-md` corners, a consistent keyboard
 * focus ring, and a hover that brightens both the surface AND the text so the
 * whole row reads as interactive. Density and tint are caller-tunable via
 * `className` (e.g. `text-xs`, a lighter `hover:bg-*`). Living in
 * `components/ui/` keeps it exempt from the "no native interactive elements"
 * lint rule.
 */
const DisclosureButton = React.forwardRef<HTMLButtonElement, DisclosureButtonProps>(
  ({ className, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2',
          'text-left text-sm text-muted-foreground transition-colors',
          'hover:bg-muted/50 hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
DisclosureButton.displayName = 'DisclosureButton';

export { DisclosureButton };
