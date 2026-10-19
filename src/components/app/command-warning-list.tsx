import type { CommandWarning } from '@/types';
import { DetailsDisclosure } from '@/components/ui/details-disclosure';

interface CommandWarningListProps {
  warnings?: readonly CommandWarning[];
}

/**
 * Engine warnings, rendered verbatim. The engine message is the visible line;
 * the driver and package reference are technical detail and appear only behind
 * the Details disclosure (shown when the "show details" setting is on).
 * Text uses theme tokens: the app's default theme is dark without a `dark`
 * class, so `dark:` variants never apply and amber-950 text was unreadable.
 */
export function CommandWarningList({ warnings }: CommandWarningListProps) {
  if (!warnings?.length) return null;

  return (
    <section
      aria-label="Command warnings"
      className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3"
    >
      <ul className="space-y-2">
        {warnings.map((warning, index) => (
          <li key={`${warning.code}-${index}`} className="text-sm text-foreground">
            <p>{warning.message}</p>
            {(warning.driver || warning.ref) && (
              <DetailsDisclosure className="mt-1">
                <p className="text-xs text-muted-foreground">
                  {warning.driver && <span>Driver: {warning.driver}</span>}
                  {warning.driver && warning.ref && <span aria-hidden="true"> · </span>}
                  {warning.ref && <span>Ref: {warning.ref}</span>}
                </p>
              </DetailsDisclosure>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
