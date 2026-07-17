import type { CommandWarning } from '@/types';

interface CommandWarningListProps {
  warnings?: readonly CommandWarning[];
}

export function CommandWarningList({ warnings }: CommandWarningListProps) {
  if (!warnings?.length) return null;

  return (
    <section
      aria-label="Command warnings"
      className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3"
    >
      <ul className="space-y-2">
        {warnings.map((warning, index) => (
          <li key={`${warning.code}-${index}`} className="text-sm text-amber-950 dark:text-amber-100">
            <p>{warning.message}</p>
            {(warning.driver || warning.ref) && (
              <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/80">
                {warning.driver && <span>Driver: {warning.driver}</span>}
                {warning.driver && warning.ref && <span aria-hidden="true"> · </span>}
                {warning.ref && <span>Ref: {warning.ref}</span>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
