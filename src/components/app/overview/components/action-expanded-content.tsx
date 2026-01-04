/**
 * ActionExpandedContent - Expanded content for action cards
 */

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Zap 
} from 'lucide-react';
import { getFadeSlideVariants } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { formatRelativeTime, type LifecycleState } from '@/lib/lifecycle-state';
import { 
  type AppEvent,
  getColorClasses,
  getPhaseColor,
} from '@/lib/apply-utils';
import { getLastEvent, formatLastEventSummary } from '../selectors';
import { LiveActivityPanel } from './live-activity-panel';
import { CaptureStatusStrip } from './capture-status-strip';
import type { 
  ActionType, 
  ActionStatus, 
  ActionProgress, 
  ActionResult, 
  SetupIntent,
  LiveCounters,
} from '../types';

interface ActionExpandedContentProps {
  action: NonNullable<ActionType>;
  lifecycleState: LifecycleState;
  isRunning: boolean;
  runningAction: ActionType;
  actionStatus: ActionStatus;
  actionProgress: ActionProgress | null;
  actionResult: ActionResult | null;
  hasProfile: boolean;
  setupIntent: SetupIntent;
  setSetupIntent: (intent: SetupIntent) => void;
  liveAppEvents: AppEvent[];
  liveCounters?: LiveCounters;
  activityExpanded: boolean;
  setActivityExpanded: (expanded: boolean) => void;
  isAtBottom: boolean;
  setIsAtBottom: (atBottom: boolean) => void;
  setUserHasScrolledAway: (scrolledAway: boolean) => void;
  activityScrollRef: React.RefObject<HTMLDivElement>;
  liveActivityContainerRef: React.RefObject<HTMLDivElement>;
  onExecuteAction: (action: ActionType) => void;
  onDismiss: () => void;
  onDismissResult: () => void;
  onSetup: (intent: SetupIntent) => void;
  onCapture: () => void;
  onShowDetails: () => void;
  setExpandedCard: (card: ActionType) => void;
  // Capture-specific props
  pendingCaptureDraft?: { capturedAppsCount: number; capturedAt: string; outputPath: string; apps: string[] } | null;
  lastSavedProfileSummary?: { appCount: number; finishedAt: string; profileName?: string } | null;
  onSaveProfile?: () => void;
  onDiscardDraft?: () => void;
}

// Action-specific descriptions
const descriptions: Record<NonNullable<ActionType>, string> = {
  capture: 'Scan your computer for installed applications and save them as a reusable setup profile.',
  setup: 'Install applications from your selected profile.',
  check: 'This computer will be compared against the selected profile.',
};

// Dynamic button labels based on setup intent
function getButtonLabel(action: NonNullable<ActionType>, running: boolean, setupIntent: SetupIntent): string {
  if (action === 'capture') return running ? 'Capturing...' : 'Start capture';
  if (action === 'setup') {
    if (running) return setupIntent === 'preview' ? 'Evaluating…' : 'Applying...';
    return setupIntent === 'preview' ? 'Preview changes' : 'Apply changes';
  }
  return running ? 'Checking...' : 'Check now';
}

// Phase-colored button classes for primary CTA
function getPhaseButtonClasses(action: NonNullable<ActionType>): string {
  switch (action) {
    case 'capture':
      return 'bg-blue-500 hover:bg-blue-600 text-white ring-1 ring-blue-500/30 hover:ring-blue-500/50';
    case 'setup':
      return 'bg-green-600 hover:bg-green-700 text-white ring-1 ring-green-600/30 hover:ring-green-600/50';
    case 'check':
      return 'bg-amber-600 hover:bg-amber-700 text-white ring-1 ring-amber-600/30 hover:ring-amber-600/50';
    default:
      return '';
  }
}

export function ActionExpandedContent({
  action,
  lifecycleState,
  isRunning,
  runningAction,
  actionStatus,
  actionProgress,
  actionResult,
  hasProfile,
  setupIntent,
  setSetupIntent,
  liveAppEvents,
  liveCounters,
  activityExpanded,
  setActivityExpanded,
  isAtBottom,
  setIsAtBottom,
  setUserHasScrolledAway,
  activityScrollRef,
  liveActivityContainerRef,
  onExecuteAction,
  onDismiss,
  onDismissResult,
  onSetup,
  onCapture,
  onShowDetails,
  setExpandedCard,
  pendingCaptureDraft,
  lastSavedProfileSummary,
  onSaveProfile,
  onDiscardDraft,
}: ActionExpandedContentProps) {
  const fadeSlideVariants = getFadeSlideVariants('up');
  const isThisRunning = runningAction === action && isRunning;
  const isThisComplete = runningAction === action && !isRunning && actionStatus !== 'idle';
  const lastEvent = getLastEvent(lifecycleState, action);
  const lastSummary = formatLastEventSummary(lifecycleState, action);

  return (
    <div className="border-t border-border mt-2 pt-4 space-y-3 pb-4">
      {/* Description */}
      <p className="text-sm text-muted-foreground">
        {descriptions[action]}
      </p>

      {/* Capture status strip - rendered inline after description for correct placement */}
      {action === 'capture' && (pendingCaptureDraft || lastSavedProfileSummary) && (
        <CaptureStatusStrip
          variant="expanded"
          pendingCaptureDraft={pendingCaptureDraft}
          lastSavedProfileSummary={lastSavedProfileSummary}
          appCount={actionResult?.counts?.total}
          onSaveProfile={onSaveProfile}
          onDiscardDraft={onDiscardDraft}
          onDismiss={onDismiss}
          onShowDetails={onShowDetails}
        />
      )}

      <AnimatePresence mode="wait">

        {/* Setup: success */}
        {action === 'setup' && isThisComplete && actionStatus === 'success' && (
          <motion.div
            key="setup-success"
            variants={fadeSlideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="flex items-center gap-3 bg-success/10 rounded-md px-3 py-3">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <div className="flex-1">
                <p className="text-sm font-medium text-success">
                  Completed successfully
                </p>
                {actionProgress?.message && (
                  <p className="text-xs text-muted-foreground">{actionProgress.message}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDetails();
                }}
              >
                Details
              </Button>
            </div>
          </motion.div>
        )}

        {/* Setup: error (partial or fatal) */}
        {action === 'setup' && isThisComplete && actionStatus === 'error' && (
          <motion.div
            key="setup-error"
            variants={fadeSlideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {actionResult?.counts?.failed && actionResult.counts.failed > 0 && (actionResult.counts.installed || actionResult.counts.alreadyPresent) ? (
              <div className="flex items-center gap-3 bg-warning/10 rounded-md px-3 py-3">
                <XCircle className="h-4 w-4 text-warning" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-warning">
                    Completed with issues
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {actionResult.counts.installed || 0} installed • {actionResult.counts.alreadyPresent || 0} already present • {actionResult.counts.failed} failed
                    {actionResult.counts.skipped && actionResult.counts.skipped > 0 ? ` • ${actionResult.counts.skipped} skipped` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowDetails();
                  }}
                >
                  Details
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-danger/10 rounded-md px-3 py-3">
                <XCircle className="h-4 w-4 text-danger" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-danger">
                    {actionResult?.counts?.failed && actionResult.counts.failed > 0
                      ? `All apps failed to install (${actionResult.counts.failed} failed)`
                      : 'Something went wrong'}
                  </p>
                  {actionProgress?.message && (
                    <p className="text-xs text-muted-foreground">{actionProgress.message}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowDetails();
                  }}
                >
                  Details
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* Check: success */}
        {action === 'check' && isThisComplete && actionStatus === 'success' && (
          <motion.div
            key="check-success"
            variants={fadeSlideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="flex items-center gap-3 bg-success/10 rounded-md px-3 py-3">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <div className="flex-1">
                <p className="text-sm font-medium text-success">
                  Completed successfully
                </p>
                {actionProgress?.message && (
                  <p className="text-xs text-muted-foreground">{actionProgress.message}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDetails();
                }}
              >
                Details
              </Button>
            </div>
          </motion.div>
        )}

        {/* Check: error */}
        {action === 'check' && isThisComplete && actionStatus === 'error' && (
          <motion.div
            key="check-error"
            variants={fadeSlideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="flex items-center gap-3 bg-danger/10 rounded-md px-3 py-3">
              <XCircle className="h-4 w-4 text-danger" />
              <div className="flex-1">
                <p className="text-sm font-medium text-danger">
                  Something went wrong
                </p>
                {actionProgress?.message && (
                  <p className="text-xs text-muted-foreground">{actionProgress.message}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDetails();
                }}
              >
                Details
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview/Apply toggle for Setup card */}
      {action === 'setup' && !isThisRunning && !isThisComplete && (
        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-md w-fit">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSetupIntent('preview');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              setupIntent === 'preview'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Eye className="h-3 w-3" />
            Preview
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSetupIntent('apply');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              setupIntent === 'apply'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Zap className="h-3 w-3" />
            Apply
          </button>
        </div>
      )}

      {/* Last run info */}
      {lastEvent && !isThisRunning && !isThisComplete && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Last run {formatRelativeTime(lastEvent.timestamp)}</span>
          {lastSummary && (
            <>
              <span className="text-border">•</span>
              <span>{lastSummary}</span>
            </>
          )}
        </div>
      )}

      {/* Running state - animated swap with result */}
      <AnimatePresence mode="wait">
      {isThisRunning && actionProgress && (
        <motion.div
          key="running"
          variants={fadeSlideVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="space-y-3"
        >
          {/* Phase-aware progress indicator */}
          {(() => {
            // Derive semantic color from action and intent to avoid flash
            // Preview (setup + preview intent) = neutral/blue, Apply = green, Capture = blue, Check = amber
            const isPreview = action === 'setup' && setupIntent === 'preview';
            const phaseColor = isPreview ? 'info' : getPhaseColor(actionProgress.phase);
            const colorClasses = getColorClasses(phaseColor);
            return (
              <div className={`flex items-center gap-3 rounded-md px-3 py-3 border ${colorClasses.bg} ${colorClasses.border}`}>
                <Loader2 className={`h-4 w-4 animate-spin ${colorClasses.text}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${colorClasses.text}`}>
                    {/* Phase indicator: show current phase for clarity */}
                    {actionProgress.phase === 'verify' ? 'Verifying installation…' : actionProgress.message}
                  </p>
                  {actionProgress.detail && (
                    <p className="text-xs text-muted-foreground truncate">{actionProgress.detail}</p>
                  )}
                </div>
              </div>
            );
          })()}
          
          {/* Collapsible live activity for Setup card */}
          {action === 'setup' && liveAppEvents.length > 0 && (
            <LiveActivityPanel
              liveAppEvents={liveAppEvents}
              liveCounters={liveCounters}
              actionProgress={actionProgress}
              activityExpanded={activityExpanded}
              setActivityExpanded={setActivityExpanded}
              isAtBottom={isAtBottom}
              setIsAtBottom={setIsAtBottom}
              setUserHasScrolledAway={setUserHasScrolledAway}
              activityScrollRef={activityScrollRef}
              liveActivityContainerRef={liveActivityContainerRef}
            />
          )}
        </motion.div>
      )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-3">
        {!isThisComplete ? (
          <>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onExecuteAction(action);
              }}
              disabled={isRunning || (action !== 'capture' && !hasProfile)}
              size="sm"
              className={getPhaseButtonClasses(action)}
            >
              {isThisRunning ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  {getButtonLabel(action, true, setupIntent)}
                </>
              ) : (
                getButtonLabel(action, false, setupIntent)
              )}
            </Button>
            {!isThisRunning && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedCard(null);
                }}
              >
                Cancel
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              size="sm"
            >
              Dismiss
            </Button>
            {/* Show "Apply changes" button after successful Preview */}
            {action === 'setup' && actionResult?.wasPreview && actionStatus === 'success' && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white ring-1 ring-green-600/30 hover:ring-green-600/50"
                onClick={(e) => {
                  e.stopPropagation();
                  // Reset state and trigger apply
                  onDismissResult();
                  setSetupIntent('apply');
                  // Small delay to ensure state is reset before triggering
                  setTimeout(() => onSetup('apply'), 50);
                }}
              >
                <Zap className="h-3 w-3 mr-1.5" />
                Apply changes
              </Button>
            )}
            {/* Show "Run again" button for capture after completion */}
            {action === 'capture' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismissResult();
                  // Small delay to ensure state is reset before triggering
                  setTimeout(() => onCapture(), 50);
                }}
              >
                Run again
              </Button>
            )}
            {/* Show "Run again" button for setup after completion (non-preview) */}
            {action === 'setup' && !actionResult?.wasPreview && (
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismissResult();
                  // Small delay to ensure state is reset before triggering
                  setTimeout(() => onSetup(setupIntent), 50);
                }}
              >
                Run again
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
