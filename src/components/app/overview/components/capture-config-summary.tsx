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
    <div className="border-t border-border" data-testid="capture-config-summary">
      <div className="px-3 py-2 bg-muted/30">
        <p className="text-xs text-muted-foreground font-medium">App Settings</p>
      </div>

      {!hasAny && (
        <div className="px-3 py-2 border-t border-border" data-testid="config-none">
          <p className="text-xs text-muted-foreground">No app settings captured</p>
        </div>
      )}

      {included.map((id) => (
        <div key={id} className="flex items-center justify-between px-3 py-2 text-xs border-t border-border" data-testid="config-included">
          <span className="font-mono truncate flex-1">{id}</span>
          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap min-w-fit bg-success/10 text-success">
            Captured
          </span>
        </div>
      ))}

      {skipped.map((id) => (
        <div key={id} className="flex items-center justify-between px-3 py-2 text-xs border-t border-border" data-testid="config-skipped">
          <span className="font-mono truncate flex-1">{id}</span>
          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap min-w-fit bg-muted text-muted-foreground">
            Skipped
          </span>
        </div>
      ))}

      {errored.map((id) => (
        <div key={id} className="flex items-center justify-between px-3 py-2 text-xs border-t border-border" data-testid="config-errored">
          <span className="font-mono truncate flex-1">{id}</span>
          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap min-w-fit bg-danger/10 text-danger">
            Error
          </span>
        </div>
      ))}
    </div>
  );
}
