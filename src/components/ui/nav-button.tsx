import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NavButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * A lightweight, inline "back"/navigation affordance — muted text + icon that
 * brightens on hover, with no chrome (no background, padding, or border).
 *
 * This is the standardized primitive for the back/nav buttons that sit at the
 * top of the Save/Setup/overview flows. It deliberately is NOT the chunky
 * shadcn `<Button>` (which would add height, padding, and a hover background);
 * the only thing it adds over the previous hand-rolled markup is a consistent
 * keyboard focus ring. Living in `components/ui/` keeps it exempt from the
 * "no native interactive elements" lint rule.
 */
const NavButton = React.forwardRef<HTMLButtonElement, NavButtonProps>(
  ({ className, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
NavButton.displayName = 'NavButton';

export { NavButton };
