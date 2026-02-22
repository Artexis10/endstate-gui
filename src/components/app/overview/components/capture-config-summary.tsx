/**
 * CaptureConfigSummary - Displays config module capture results in the details modal.
 * Only renders when capture used zip bundle format (outputFormat === 'zip').
 */

import type { ActionResult } from '../types';

interface CaptureConfigSummaryProps {
  actionResult: ActionResult;
}

export function CaptureConfigSummary({ actionResult }: CaptureConfigSummaryProps) {
  // Only show for zip bundles (config modules are part of the bundle)
  if (actionResult.outputFormat !== 'zip') {
    return null;
  }

  const included = actionResult.configsIncluded ?? [];
  const skipped = actionResult.configsSkipped ?? [];
  const errored = actionResult.configsCaptureErrors ?? [];

  const hasAny = included.length > 0 || skipped.length > 0 || errored.length > 0;

  return (
    <div className="flex-shrink-0 space-y-2" data-testid="capture-config-summary">
      <p className="text-xs text-muted-foreground font-medium">App Settings</p>

      {!hasAny && (
        <p className="text-xs text-muted-foreground" data-testid="config-none">
          No app settings captured
        </p>
      )}

      {included.length > 0 && (
        <div data-testid="config-included">
          <p className="text-xs text-muted-foreground mb-1">Settings captured</p>
          <div className="space-y-0.5">
            {included.map((id) => (
              <p key={id} className="text-xs text-success font-mono pl-2">{id}</p>
            ))}
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <div data-testid="config-skipped">
          <p className="text-xs text-muted-foreground mb-1">Settings skipped</p>
          <div className="space-y-0.5">
            {skipped.map((id) => (
              <p key={id} className="text-xs text-muted-foreground font-mono pl-2">{id}</p>
            ))}
          </div>
        </div>
      )}

      {errored.length > 0 && (
        <div data-testid="config-errored">
          <p className="text-xs text-muted-foreground mb-1">Settings errors</p>
          <div className="space-y-0.5">
            {errored.map((id) => (
              <p key={id} className="text-xs text-danger font-mono pl-2">{id}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
