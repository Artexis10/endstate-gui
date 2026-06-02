import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FilterChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Reflected as `aria-pressed`; the chip's selected/active state. */
  pressed: boolean;
  /** Dim to `opacity-50` (used when another filter is active and this isn't). */
  dimmed?: boolean;
}

/**
 * Small toggle chip used for the result filters in the Save/Setup flows
 * ("N apps", "M settings", per-status counts). Semantic colors are supplied by
 * the caller via `className` (e.g. `getColorClasses(...).bg/.text`) so this
 * primitive stays presentation-only. Renders a real `<button>` (exempt from the
 * native-control lint rule because it lives in `components/ui/`).
 */
const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ pressed, dimmed = false, className, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={pressed}
        className={cn(
          'px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-opacity',
          dimmed && 'opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);
FilterChip.displayName = 'FilterChip';

export { FilterChip };
