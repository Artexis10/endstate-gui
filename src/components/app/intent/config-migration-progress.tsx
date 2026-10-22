import type { ConfigProgressEvent, ConfigResolutionEvent } from '@/lib/streaming-events';
import { disposition, foldedLine } from '@/lib/config-resolution-fold';

interface ConfigMigrationProgressProps {
  events: ConfigProgressEvent[];
}

function isResolution(event: ConfigProgressEvent): event is ConfigResolutionEvent {
  return event.event === 'config-resolution';
}

export function ConfigMigrationProgress(
  { events }: ConfigMigrationProgressProps,
) {
  if (events.length === 0) return null;

  // Same rule as the final list: a resolution that needs nothing from the person
  // is not a box of its own. Migration events always stay rows.
  const rows = events.filter((event) => !isResolution(event) || disposition(event) === 'attention');
  const resolutions = events.filter(isResolution);
  const folded = resolutions.filter((event) => disposition(event) === 'folded');
  const confirmations = [
    ...new Set(
      resolutions.filter((event) => disposition(event) === 'direct').map((event) => event.label),
    ),
  ];

  return (
    <section aria-label="Settings progress">
      {/* Always mounted, even empty, so the first row that needs the person is
          announced: a live region must exist before its content changes. */}
      <ul className="space-y-2" aria-live="polite">
        {rows.map((event, index) => (
          <li
            key={`${event.captureId}-${event.event}-${event.timestamp}-${index}`}
            className="rounded-md border border-border bg-muted/20 p-2 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                {event.event === 'config-resolution' && (
                  <p className="font-medium">{event.label}</p>
                )}
                <p data-testid="config-progress-message">{event.message}</p>
                {event.remediation !== null && (
                  <p className="text-muted-foreground">{event.remediation}</p>
                )}
              </div>
              {event.event === 'config-migration' && (
                <span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground">
                  {event.status}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {/* Outside the live region: the count changes with every event, and a
          screen reader must not announce each change. */}
      {(confirmations.length > 0 || folded.length > 0) && (
        <div className={`space-y-2 ${rows.length > 0 ? 'mt-2' : ''}`}>
          {confirmations.map((label) => (
            <p key={label} className="text-xs text-muted-foreground" data-testid="config-progress-direct">
              {label}
            </p>
          ))}
          {folded.length > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="config-progress-folded">
              {foldedLine(folded)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
