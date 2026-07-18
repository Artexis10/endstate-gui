import type { ConfigProgressEvent } from '@/lib/streaming-events';

interface ConfigMigrationProgressProps {
  events: ConfigProgressEvent[];
}

export function ConfigMigrationProgress(
  { events }: ConfigMigrationProgressProps,
) {
  if (events.length === 0) return null;

  return (
    <section aria-label="Settings progress" aria-live="polite">
      <ul className="space-y-2">
        {events.map((event, index) => (
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
    </section>
  );
}
