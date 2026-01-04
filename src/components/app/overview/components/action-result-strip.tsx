/**
 * ActionResultStrip - Status strip for setup/check cards (collapsed state)
 */

import { CheckCircle2, XCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ActionType, ActionStatus, ActionProgress, ActionResult } from '../types';

interface ActionResultStripProps {
  action: NonNullable<ActionType>;
  actionStatus: ActionStatus;
  actionProgress: ActionProgress | null;
  actionResult: ActionResult | null;
  runningAction: ActionType;
  isRunning: boolean;
  onDismiss: () => void;
  onShowDetails: () => void;
}

export function ActionResultStrip({
  action,
  actionStatus,
  actionProgress,
  actionResult,
  runningAction,
  isRunning,
  onDismiss,
  onShowDetails,
}: ActionResultStripProps) {
  // Determine if this card has a displayable result state
  const isThisComplete = runningAction === action && !isRunning && actionStatus !== 'idle';
  const isThisRunning = runningAction === action && isRunning;
  
  // Only show strip if there's something to display AND card is collapsed
  if (!isThisComplete || isThisRunning) return null;
  
  // Determine status strip content
  let statusText = '';
  let detailText = '';
  let statusColor: 'success' | 'warning' | 'error' = 'success';
  const testIdSuffix = action === 'setup' ? 'apply' : 'verify';
  
  if (actionStatus === 'success') {
    statusText = 'Completed successfully';
    detailText = actionProgress?.message || '';
  } else if (actionStatus === 'error') {
    // Check for partial failure
    if (actionResult?.counts?.failed && actionResult.counts.failed > 0 && 
        (actionResult.counts.installed || actionResult.counts.alreadyPresent)) {
      statusText = 'Completed with issues';
      statusColor = 'warning';
      detailText = `${actionResult.counts.installed || 0} installed · ${actionResult.counts.failed} failed`;
    } else {
      statusText = 'Something went wrong';
      statusColor = 'error';
      detailText = actionProgress?.message || '';
    }
  }
  
  if (!statusText) return null;
  
  const colorClasses = statusColor === 'success' 
    ? 'bg-success/10 text-success border-success/20'
    : statusColor === 'warning'
    ? 'bg-warning/10 text-warning border-warning/20'
    : 'bg-danger/10 text-danger border-danger/20';
  
  const IconComponent = statusColor === 'success' ? CheckCircle2 
    : statusColor === 'warning' ? FileText 
    : XCircle;
  
  return (
    <div className="pt-8">
      <div 
        className={`flex items-center gap-3 px-3 py-2.5 rounded-md border text-sm ${colorClasses}`}
        data-testid={`card-status-strip-${testIdSuffix}`}
      >
        <IconComponent className="h-4 w-4 flex-shrink-0" />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-medium whitespace-nowrap">{statusText}</span>
          {detailText && (
            <>
              <span className="text-muted-foreground flex-shrink-0">—</span>
              <span className="text-muted-foreground truncate">{detailText}</span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          data-testid="card-status-dismiss"
        >
          Dismiss
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onShowDetails();
          }}
        >
          Details
        </Button>
      </div>
    </div>
  );
}
