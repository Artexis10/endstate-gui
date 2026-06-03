import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PillProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * A small interactive `rounded-full` pill — the standardized primitive for the
 * clickable status/action chips (hosted-backup status, the "Latest" jump pill,
 * etc.). It bakes in the pill shape, border, compact padding, color
 * transition, and a consistent keyboard focus ring; the per-state colour
 * (border/bg/text + hover) is passed via `className` since it is theme- and
 * status-specific.
 *
 * Distinct from `FilterChip` (a toggle for result filters) and `Badge` (a
 * non-interactive label). Living in `components/ui/` keeps it exempt from the
 * "no native interactive elements" lint rule.
 */
const Pill = React.forwardRef<HTMLButtonElement, PillProps>(
  ({ className, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Pill.displayName = 'Pill';

export { Pill };
