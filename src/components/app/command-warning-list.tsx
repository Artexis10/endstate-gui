import type { CommandWarning } from '@/types';
import { DetailsDisclosure } from '@/components/ui/details-disclosure';

interface CommandWarningListProps {
  warnings?: readonly CommandWarning[];
}

/**
 * A warning's technical fields, verbatim, behind the Details disclosure (shown
 * only when the "show details" setting is on). Absent fields are left out.
 */
export function CommandWarningDetails({ warning, className = 'mt-1' }: { warning: CommandWarning; className?: string }) {
  const fields = [
    ['Code', warning.code],
    ['Driver', warning.driver],
    ['Source', warning.source],
    ['Ref', warning.ref],
    ['Module', warning.moduleId],
  ].filter((field): field is [string, string] => !!field[1]);

  return (
    <DetailsDisclosure className={className}>
      <p className="text-xs text-muted-foreground">
        {fields.map(([label, value], index) => (
          <span key={label}>
            {index > 0 && <span aria-hidden="true"> · </span>}
            <span>{label}: {value}</span>
          </span>
        ))}
      </p>
    </DetailsDisclosure>
  );
}

/**
 * Engine warnings, rendered verbatim. The engine message is the visible line;
 * the code, driver, source, package reference and module are technical detail
 * and appear only behind the Details disclosure.
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
            <CommandWarningDetails warning={warning} />
          </li>
        ))}
      </ul>
    </section>
  );
}
