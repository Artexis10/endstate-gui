/**
 * Overview (Home) Screen - The default landing page for Endstate
 * 
 * This screen integrates the lifecycle conceptually by surfacing:
 * - Primary actions (Capture, Set up, Check)
 * - Current profile (if any)
 * - Recent lifecycle activity
 * 
 * Non-technical users should be able to complete core tasks
 * without ever needing to navigate away from this screen.
 * 
 * Action cards expand in-place to execute actions. Power users can
 * access detailed activity via per-section "Show activity" disclosure.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getExpandCollapseVariants,
  getFadeSlideVariants,
  getFadeVariants,
  getLayoutTransition,
} from '@/lib/motion';
import { 
  ScanSearch, 
  PlayCircle, 
  CheckCircle,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  Zap,
  MoreVertical,
  ArrowDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatRelativeTime, type LifecycleState, type LifecycleEvent } from '@/lib/lifecycle-state';
import type { DiscoveredProfile } from '@/file-discovery';
import { ManageProfilesModal } from './manage-profiles-modal';
import { ViewAppsModal } from './view-apps-modal';
import { 
  type AppEvent, 
  type StatusKey,
  type UiPhase,
  getColorClasses,
  getPhaseAwareStatusForEvent,
  getPhaseColor,
} from '@/lib/apply-utils';
import { formatAppIdentity } from '@/lib/app-identity';

type ActionType = 'capture' | 'setup' | 'check' | null;
type ActionStatus = 'idle' | 'running' | 'success' | 'error';
type SetupIntent = 'preview' | 'apply';

interface ActionProgress {
  message: string;
  detail?: string;
  phase?: UiPhase;  // Current engine phase for UI clarity
}

interface ActionResult {
  action: ActionType;
  status: 'success' | 'error';
  summary: string;
  details?: string[];
  appEvents?: AppEvent[];
  counts?: {
    installed?: number;
    skipped?: number;
    failed?: number;
    alreadyPresent?: number;
    toInstall?: number;
    missing?: number;
    total?: number;
    manifestTotal?: number; // Total apps in profile manifest (source of truth)
  };
  profile?: string;
  timestamp?: string;
  wasPreview?: boolean; // Track if this was a preview (for showing Apply button)
}

interface LiveCounters {
  installed: number;
  alreadyPresent: number;
  skipped: number;
  failed: number;
}

interface OverviewScreenProps {
  lifecycleState: LifecycleState;
  selectedProfile: string;
  profiles: DiscoveredProfile[];
  profilesDirectory: string;
  isRunning: boolean;
  runningAction: ActionType;
  actionStatus: ActionStatus;
  actionProgress: ActionProgress | null;
  actionResult: ActionResult | null;
  liveAppEvents?: AppEvent[];
  liveCounters?: LiveCounters;
  initialExpandedCard?: ActionType;
  lastCaptureSummary?: {
    appCount: number;
    finishedAt: string;
    runId?: string;
  } | null;
  onNavigate: (page: 'report' | 'settings') => void;
  onCapture: () => void;
  onSetup: (intent: SetupIntent) => void;
  onCheck: () => void;
  onProfileChange: (profile: string, path: string) => void;
  onDismissResult: () => void;
  onOpenProfilesFolder: () => void;
  onRefreshProfiles: () => Promise<void>;
  onRenameProfile?: (path: string, currentName: string) => void;
  onDeleteProfile?: (path: string, displayName: string) => void;
  onSetActiveProfile?: (profile: DiscoveredProfile) => void;
  onClearExpandedCard?: () => void;
  onSaveProfile?: () => void;
  onDiscardDraft?: () => void;
  pendingCaptureDraftPath?: string | null;
}

export function OverviewScreen({
  lifecycleState,
  selectedProfile,
  profiles,
  profilesDirectory,
  isRunning,
  runningAction,
  actionStatus,
  actionProgress,
  actionResult,
  liveAppEvents = [],
  liveCounters,
  initialExpandedCard,
  lastCaptureSummary,
  onNavigate,
  onCapture,
  onSetup,
  onCheck,
  onProfileChange,
  onDismissResult,
  onOpenProfilesFolder,
  onRefreshProfiles,
  onRenameProfile,
  onDeleteProfile,
  onSetActiveProfile,
  onClearExpandedCard,
  onSaveProfile,
  onDiscardDraft,
  pendingCaptureDraftPath,
}: OverviewScreenProps) {
  // Initialize expandedCard: prioritize active running action, then initialExpandedCard, then null
  // This ensures returning to Overview during an active run shows the correct expanded card
  const [expandedCard, setExpandedCard] = useState<ActionType>(() => {
    if (isRunning && runningAction) return runningAction;
    return initialExpandedCard ?? null;
  });
  
  // Handle external initialExpandedCard changes (e.g., from redirect)
  useEffect(() => {
    if (initialExpandedCard) {
      setExpandedCard(initialExpandedCard);
      // Clear the external state after applying it
      onClearExpandedCard?.();
    }
  }, [initialExpandedCard, onClearExpandedCard]);
  
  // Sync expandedCard when returning to Overview during an active run
  // This handles the case where user navigates away and back while a run is in progress
  useEffect(() => {
    if (isRunning && runningAction && expandedCard !== runningAction) {
      setExpandedCard(runningAction);
    }
  }, [isRunning, runningAction]);
  const [setupIntent, setSetupIntent] = useState<SetupIntent>('preview');
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsFilter, setDetailsFilter] = useState<StatusKey | 'all' | null>(null);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [manageProfilesOpen, setManageProfilesOpen] = useState(false);
  const [viewProfilePath, setViewProfilePath] = useState<string | null>(null);
  const [viewProfileName] = useState<string>('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [lastSeenPhase, setLastSeenPhase] = useState<UiPhase | undefined>(undefined);
  const [userHasScrolledAway, setUserHasScrolledAway] = useState(false);
  const activityScrollRef = useRef<HTMLDivElement>(null);
  const liveActivityContainerRef = useRef<HTMLDivElement>(null);
  const captureCardRef = useRef<HTMLDivElement>(null);
  const setupCardRef = useRef<HTMLDivElement>(null);
  const checkCardRef = useRef<HTMLDivElement>(null);
  const hasProfile = !!selectedProfile && profiles.length > 0;
  
  // Reset activity expanded state when a new run starts
  useEffect(() => {
    if (isRunning && runningAction) {
      // Always start collapsed for calm UI; users can expand to see details
      setActivityExpanded(false);
      setIsAtBottom(true); // Reset scroll position for new run
      setUserHasScrolledAway(false); // Reset user scroll tracking for new run
      setLastSeenPhase(undefined); // Reset phase tracking for new run
    }
  }, [isRunning, runningAction]);
  
  // Auto-scroll to bottom when new events arrive, but only if user is at bottom
  useEffect(() => {
    if (isAtBottom && activityScrollRef.current && activityExpanded) {
      activityScrollRef.current.scrollTop = activityScrollRef.current.scrollHeight;
    }
  }, [liveAppEvents, isAtBottom, activityExpanded]);
  
  // Auto-scroll Live Activity into view when entering VERIFY phase
  // Only scroll if: panel is expanded, user hasn't scrolled away, and phase just changed to verify
  useEffect(() => {
    const currentPhase = actionProgress?.phase;
    if (
      currentPhase === 'verify' &&
      lastSeenPhase !== 'verify' &&
      activityExpanded &&
      !userHasScrolledAway &&
      liveActivityContainerRef.current
    ) {
      // Smooth scroll the Live Activity container into view
      liveActivityContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    setLastSeenPhase(currentPhase);
  }, [actionProgress?.phase, lastSeenPhase, activityExpanded, userHasScrolledAway]);
  
  // Handle card click - always expand in-place
  const handleCardClick = (action: ActionType) => {
    if (isRunning) return;
    
    // Toggle card expansion
    if (expandedCard === action) {
      // Only collapse if not running and not showing result
      if (actionStatus === 'idle') {
        setExpandedCard(null);
      }
    } else {
      setExpandedCard(action);
    }
  };

  // Execute action from expanded card
  const handleExecuteAction = (action: ActionType) => {
    if (!action) return;
    
    // Scroll to the relevant card when action starts
    const scrollToCard = (ref: React.RefObject<HTMLDivElement>) => {
      if (ref.current && typeof ref.current.scrollIntoView === 'function') {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    
    if (action === 'capture') {
      scrollToCard(captureCardRef);
      onCapture();
    } else if (action === 'setup') {
      scrollToCard(setupCardRef);
      onSetup(setupIntent);
    } else if (action === 'check') {
      scrollToCard(checkCardRef);
      onCheck();
    }
  };

  // Collapse card and dismiss result
  const handleDismiss = () => {
    setExpandedCard(null);
    onDismissResult();
  };

  // Get last event for an action type
  const getLastEvent = (action: ActionType): LifecycleEvent | null => {
    switch (action) {
      case 'capture':
        return lifecycleState.lastCapture;
      case 'setup':
        return lifecycleState.lastApply || lifecycleState.lastPreview;
      case 'check':
        return lifecycleState.lastVerify || lifecycleState.lastPreview;
      default:
        return null;
    }
  };

  // Format last event summary
  const formatLastEventSummary = (action: ActionType): string | null => {
    const event = getLastEvent(action);
    if (!event) return null;
    
    switch (action) {
      case 'capture':
        return event.summary?.total ? `${event.summary.total} apps captured` : null;
      case 'setup':
        if (event.summary?.installed !== undefined) {
          return `${event.summary.installed} installed, ${event.summary.alreadyPresent || 0} already present`;
        }
        return null;
      case 'check':
        if (event.summary?.missing !== undefined && event.summary.missing > 0) {
          return `${event.summary.missing} missing`;
        }
        if (event.summary?.alreadyPresent !== undefined) {
          return `${event.summary.alreadyPresent} present`;
        }
        return null;
      default:
        return null;
    }
  };

  const recentActivity = [
    lifecycleState.lastCapture && {
      type: 'capture' as const,
      label: 'Captured computer',
      timestamp: lifecycleState.lastCapture.timestamp,
      success: lifecycleState.lastCapture.success,
      summary: lifecycleState.lastCapture.summary?.total 
        ? `${lifecycleState.lastCapture.summary.total} apps`
        : undefined,
    },
    lifecycleState.lastPreview && {
      type: 'preview' as const,
      label: 'Previewed setup',
      timestamp: lifecycleState.lastPreview.timestamp,
      success: lifecycleState.lastPreview.success,
      profile: lifecycleState.lastPreview.profile,
      summary: lifecycleState.lastPreview.summary?.installed !== undefined
        ? `${lifecycleState.lastPreview.summary.installed} to install`
        : undefined,
    },
    lifecycleState.lastApply && {
      type: 'apply' as const,
      label: 'Applied setup',
      timestamp: lifecycleState.lastApply.timestamp,
      success: lifecycleState.lastApply.success,
      profile: lifecycleState.lastApply.profile,
      summary: lifecycleState.lastApply.summary?.installed !== undefined
        ? `${lifecycleState.lastApply.summary.installed} installed`
        : undefined,
    },
    lifecycleState.lastVerify && {
      type: 'verify' as const,
      label: 'Checked computer',
      timestamp: lifecycleState.lastVerify.timestamp,
      success: lifecycleState.lastVerify.success,
      profile: lifecycleState.lastVerify.profile,
      summary: lifecycleState.lastVerify.summary?.missing !== undefined && lifecycleState.lastVerify.summary.missing > 0
        ? `${lifecycleState.lastVerify.summary.missing} missing`
        : lifecycleState.lastVerify.summary?.alreadyPresent !== undefined
          ? `${lifecycleState.lastVerify.summary.alreadyPresent} present`
          : undefined,
    },
  ].filter(Boolean).sort((a, b) => 
    new Date(b!.timestamp).getTime() - new Date(a!.timestamp).getTime()
  ).slice(0, 3);

  // Motion variants - computed fresh to respect current reduced-motion preference
  const expandCollapseVariants = getExpandCollapseVariants();
  const fadeSlideVariants = getFadeSlideVariants('up');
  const fadeVariants = getFadeVariants();
  const layoutTransition = getLayoutTransition();

  // Render expanded content for a card
  const renderExpandedContent = (action: ActionType) => {
    const isThisRunning = runningAction === action && isRunning;
    const isThisComplete = runningAction === action && !isRunning && actionStatus !== 'idle';
    const lastEvent = getLastEvent(action);
    const lastSummary = formatLastEventSummary(action);
    
    // Action-specific descriptions
    const descriptions: Record<NonNullable<ActionType>, string> = {
      capture: 'Scan your computer for installed applications and save them as a reusable setup profile.',
      setup: 'Install applications from your selected profile.',
      check: 'This computer will be compared against the selected profile.',
    };

    // Dynamic button labels based on setup intent
    const getButtonLabel = (act: NonNullable<ActionType>, running: boolean): string => {
      if (act === 'capture') return running ? 'Capturing...' : 'Start capture';
      if (act === 'setup') {
        if (running) return setupIntent === 'preview' ? 'Evaluating…' : 'Applying...';
        return setupIntent === 'preview' ? 'Preview changes' : 'Apply changes';
      }
      return running ? 'Checking...' : 'Check now';
    };

    // Phase-colored button classes for primary CTA
    const getPhaseButtonClasses = (act: NonNullable<ActionType>): string => {
      switch (act) {
        case 'capture':
          return 'bg-blue-500 hover:bg-blue-600 text-white ring-1 ring-blue-500/30 hover:ring-blue-500/50';
        case 'setup':
          return 'bg-green-600 hover:bg-green-700 text-white ring-1 ring-green-600/30 hover:ring-green-600/50';
        case 'check':
          return 'bg-amber-600 hover:bg-amber-700 text-white ring-1 ring-amber-600/30 hover:ring-amber-600/50';
        default:
          return '';
      }
    };

    if (!action) return null;

    return (
      <div className="border-t border-border mt-3 pt-4 space-y-3 pb-4">
        {/* Description */}
        <p className="text-sm text-muted-foreground">
          {descriptions[action]}
        </p>


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
            
            {/* Collapsible live activity for Setup card - animated container */}
            <AnimatePresence>
            {action === 'setup' && liveAppEvents.length > 0 && (() => {
              const phaseColor = getPhaseColor(actionProgress.phase);
              const colorClasses = getColorClasses(phaseColor);
              const isVerifyPhase = actionProgress.phase === 'verify';
              return (
                <motion.div 
                  key="live-activity"
                  ref={liveActivityContainerRef}
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className={`rounded-md border ${isVerifyPhase ? `${colorClasses.border} ${colorClasses.bg}` : 'border-border/50'}`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivityExpanded(!activityExpanded);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                  >
                    <span className="font-medium flex items-center gap-2">
                      Live activity
                      {/* Phase badge for visual distinction */}
                      {isVerifyPhase && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${colorClasses.bg} ${colorClasses.text}`}>
                          VERIFY
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {liveCounters && (
                        <span className="flex items-center gap-1.5">
                          {/* Use semantic colors from UI_STATUS_MAP */}
                          {liveCounters.installed > 0 && <span className={getColorClasses('success').text}>✓{liveCounters.installed}</span>}
                          {liveCounters.alreadyPresent > 0 && <span className={getColorClasses('success').text}>●{liveCounters.alreadyPresent}</span>}
                          {liveCounters.skipped > 0 && <span className={getColorClasses('warn').text}>⊘{liveCounters.skipped}</span>}
                          {liveCounters.failed > 0 && <span className={getColorClasses('error').text}>✗{liveCounters.failed}</span>}
                        </span>
                      )}
                      {activityExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </div>
                  </button>
                  {activityExpanded && (
                    <div className="relative border-t border-border/50">
                      <div 
                        ref={activityScrollRef}
                        className="px-3 pb-3 space-y-1 max-h-64 overflow-y-auto scrollbar-thin"
                        onScroll={(e) => {
                          const target = e.currentTarget;
                          const atBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 5;
                          setIsAtBottom(atBottom);
                          // Track if user has scrolled away (not at bottom) to prevent auto-scroll on phase change
                          if (!atBottom) {
                            setUserHasScrolledAway(true);
                          }
                        }}
                      >
                        {liveAppEvents.map((event, idx) => {
                          // Skip phase header events - the phase badge already signals the current phase
                          if (event.app === '── APPLY ──' || event.app === '── VERIFY ──') {
                            return null;
                          }
                          
                          // Use statusKey if available, otherwise derive from action
                          const statusKey: StatusKey = event.statusKey || (
                            event.action === 'OK' ? 'present' :
                            event.action === 'Installed' ? 'installed' :
                            event.action === 'Failed' ? 'failed' :
                            event.action === 'Skipped' ? 'skipped' :
                            event.action === 'Cancelled' ? 'cancelled' :
                            event.action === 'Processing' ? 'installing' :
                            event.action === 'To install' ? 'to_install' :
                            'skipped'
                          );
                          // Use phase-aware status with reason for correct labels per phase
                          const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: event.phase, reason: event.reason });
                          const colors = getColorClasses(uiStatus.color);
                          
                          return (
                            <div key={`${event.app}-${event.timestamp}-${idx}`} className="flex items-center gap-2 text-xs pt-1.5">
                              <span className={`w-16 text-right font-medium ${colors.text}`}>
                                {uiStatus.shortLabel}
                              </span>
                              <span className="font-mono truncate flex-1">{formatAppIdentity(event.app)}</span>
                            </div>
                          );
                        })}
                      </div>
                      {!isAtBottom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Scroll to bottom and re-enable auto-follow
                            activityScrollRef.current?.scrollTo({ top: activityScrollRef.current.scrollHeight, behavior: 'smooth' });
                            setIsAtBottom(true);
                          }}
                          className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
                          aria-label="Jump to latest and re-enable auto-follow"
                          data-testid="latest-pill"
                        >
                          <ArrowDown className="h-3 w-3" />
                          Latest
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })()}
            </AnimatePresence>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Success state - animated swap with running */}
        <AnimatePresence mode="wait">
        {isThisComplete && actionStatus === 'success' && action !== 'capture' && (
          <motion.div
            key="success"
            variants={fadeSlideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-3"
          >
            {/* Success completion strip for Setup and Check only - Capture uses canonical strip */}
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
                  setDetailsModalOpen(true);
                }}
              >
                View details
              </Button>
            </div>
          </motion.div>
        )}

        {/* Error state - distinguish partial failures from hard errors */}
        {isThisComplete && actionStatus === 'error' && (
          <motion.div
            key="error"
            variants={fadeSlideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-3"
          >
            {actionResult?.counts?.failed && actionResult.counts.failed > 0 && (actionResult.counts.installed || actionResult.counts.alreadyPresent) ? (
              // Partial failure: some apps succeeded, some failed
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
                    setDetailsModalOpen(true);
                  }}
                >
                  View details
                </Button>
              </div>
            ) : (
              // Fatal error: nothing succeeded or no counts available
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
                    setDetailsModalOpen(true);
                  }}
                >
                  View details
                </Button>
              </div>
            )}
          </motion.div>
        )}
        </AnimatePresence>

        {/* Visual separator before action row */}
        <div className="border-t border-border/50 pt-3 mt-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isThisComplete ? (
            <>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExecuteAction(action);
                }}
                disabled={isRunning || (action !== 'capture' && !hasProfile)}
                size="sm"
                className={getPhaseButtonClasses(action)}
              >
                {isThisRunning ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    {getButtonLabel(action, true)}
                  </>
                ) : (
                  getButtonLabel(action, false)
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
                  handleDismiss();
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
  };

  // Check if a card should be disabled (another action is running)
  const isCardDisabled = (action: ActionType) => {
    if (isRunning && runningAction !== action) return true;
    if (action !== 'capture' && !hasProfile) return true;
    return false;
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Endstate</h1>
        <p className="text-muted-foreground">
          Capture, apply, and verify your computer setup
        </p>
      </div>


      {/* Current Profile Card (if any) */}
      {hasProfile && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 space-y-3" data-testid="current-profile-card-content">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Selected Profile</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {profiles.find(p => p.name === selectedProfile)?.displayName 
                      ? `${profiles.find(p => p.name === selectedProfile)?.displayName} (${selectedProfile})`
                      : selectedProfile}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedProfile}
                  onValueChange={(value) => {
                    const selected = profiles.find(p => p.name === value);
                    onProfileChange(value, selected?.path || '');
                  }}
                  disabled={isRunning}
                >
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.displayName ? `${p.displayName} (${p.name})` : p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setManageProfilesOpen(true);
                  }}
                  disabled={isRunning}
                  title="Manage profiles"
                  aria-label="Manage profiles"
                  data-testid="manage-profiles-button"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Profile Prompt - appears BEFORE Primary Actions */}
      {!hasProfile && profiles.length === 0 && (
        <Card className="border-dashed" data-testid="no-profile-prompt">
          <CardContent className="py-6 text-center" data-testid="no-profile-card-content">
            <p className="text-sm text-muted-foreground mb-4">
              No setup profiles found. Start by capturing your current computer setup.
            </p>
            <Button onClick={onCapture} disabled={isRunning}>
              <ScanSearch className="h-4 w-4 mr-2" />
              Capture computer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Primary Actions - Expandable Cards */}
      <div className="space-y-6">
        {/* Primary Portal Cards */}
        <div className="space-y-4">
          {/* Capture Card - PRIMARY */}
          <motion.div layout transition={layoutTransition} ref={captureCardRef}>
            <Card 
              data-testid="overview-card-capture"
              className={`cursor-pointer transition-all duration-200 border-l-2 ${
                expandedCard === 'capture' 
                  ? 'border-l-blue-500 border-blue-500/50 shadow-md' 
                  : 'border-l-blue-500/50 hover:border-l-blue-500 hover:border-primary/30'
              } ${isCardDisabled('capture') ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handleCardClick('capture')}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <ScanSearch className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Capture computer</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Save your current setup as a reusable profile
                      </CardDescription>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: expandedCard === 'capture' ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                </div>
              </CardHeader>
              
              {/* Unified status strip: draft warning OR success (always visible) */}
              <AnimatePresence mode="wait">
                {pendingCaptureDraftPath ? (
                  <motion.div
                    key="draft-status"
                    variants={fadeSlideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <CardContent className="pt-0 pb-3">
                      <div className="flex items-center gap-3 bg-warning/10 rounded-md px-3 py-3 border border-warning/20" data-testid="capture-draft-card">
                        <FileText className="h-4 w-4 text-warning" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-warning">
                            Capture finished
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Not saved yet — save to create a profile
                          </p>
                        </div>
                        {onDiscardDraft && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDiscardDraft();
                            }}
                            data-testid="discard-draft-button"
                          >
                            Discard draft
                          </Button>
                        )}
                        {onSaveProfile && (
                          <Button
                            size="sm"
                            className="bg-warning hover:bg-warning/90 text-warning-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSaveProfile();
                            }}
                            data-testid="save-profile-button"
                          >
                            Save profile
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </motion.div>
                ) : lastCaptureSummary ? (
                  <motion.div
                    key="capture-success"
                    variants={fadeSlideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <CardContent className="pt-0 pb-3">
                      <div className="flex items-center gap-3 bg-success/10 rounded-md px-3 py-3 border border-success/20" data-testid="capture-success-card">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-success">
                            Completed successfully
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lastCaptureSummary.appCount === 0 
                              ? 'No apps detected' 
                              : `${lastCaptureSummary.appCount} apps captured`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailsModalOpen(true);
                          }}
                        >
                          View details
                        </Button>
                      </div>
                    </CardContent>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              
              <AnimatePresence initial={false}>
                {expandedCard === 'capture' && (
                  <motion.div
                    key="capture-content"
                    variants={expandCollapseVariants}
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                  >
                    <CardContent className="pt-0 pb-4" data-testid="capture-card-expanded-content">
                      {renderExpandedContent('capture')}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* Setup Card - PRIMARY */}
          <motion.div layout transition={layoutTransition} ref={setupCardRef}>
            <Card 
              data-testid="overview-card-apply"
              className={`cursor-pointer transition-all duration-200 border-l-2 ${
                expandedCard === 'setup' 
                  ? 'border-l-green-500 border-green-500/50 shadow-md' 
                  : 'border-l-green-500/50 hover:border-l-green-500 hover:border-primary/30'
              } ${isCardDisabled('setup') ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handleCardClick('setup')}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <PlayCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Set up computer</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {hasProfile 
                          ? 'Install apps from your saved profile'
                          : 'Capture a profile first to get started'
                        }
                      </CardDescription>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: expandedCard === 'setup' ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                </div>
              </CardHeader>
              <AnimatePresence initial={false}>
                {expandedCard === 'setup' && (
                  <motion.div
                    key="setup-content"
                    variants={expandCollapseVariants}
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                  >
                    <CardContent className="pt-0 pb-4" data-testid="setup-card-expanded-content">
                      {renderExpandedContent('setup')}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        </div>

        {/* Secondary Validation Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Validation</h3>
          {/* Check Card - SECONDARY */}
          <motion.div layout transition={layoutTransition} ref={checkCardRef}>
            <Card 
              data-testid="overview-card-verify"
              className={`cursor-pointer transition-all duration-200 border-l-2 ${
                expandedCard === 'check' 
                  ? 'border-l-amber-500 border-amber-500/50 shadow-md' 
                  : 'border-l-amber-500/50 hover:border-l-amber-500 hover:border-primary/30'
              } ${isCardDisabled('check') ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handleCardClick('check')}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <CheckCircle className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Check computer</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {hasProfile 
                          ? 'Verify your setup matches the profile'
                          : 'Capture a profile first to get started'
                        }
                      </CardDescription>
                    </div>
                  </div>
                  <motion.div
                    animate={{ rotate: expandedCard === 'check' ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                </div>
              </CardHeader>
              <AnimatePresence initial={false}>
                {expandedCard === 'check' && (
                  <motion.div
                    key="check-content"
                    variants={expandCollapseVariants}
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                  >
                    <CardContent className="pt-0 pb-4" data-testid="check-card-expanded-content">
                      {renderExpandedContent('check')}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent Activity
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs"
                onClick={() => onNavigate('report')}
              >
                View all
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <div 
                  key={`${activity!.type}-${activity!.timestamp}`}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity!.success ? 'bg-success' : 'bg-warning'
                    }`} />
                    <div>
                      <p className="text-sm font-medium">{activity!.label}</p>
                      {activity!.profile && (
                        <p className="text-xs text-muted-foreground">{activity!.profile}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(activity!.timestamp)}
                    </p>
                    {activity!.summary && (
                      <p className="text-xs font-medium">{activity!.summary}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Details Modal - shows logs/results without navigation */}
      <Dialog open={detailsModalOpen} onOpenChange={(open) => {
        setDetailsModalOpen(open);
        if (!open) setDetailsFilter(null); // Reset filter when closing
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              {actionResult?.action === 'capture' && 'Capture Details'}
              {actionResult?.action === 'setup' && 'Setup Details'}
              {actionResult?.action === 'check' && 'Check Details'}
              {!actionResult?.action && 'Details'}
            </DialogTitle>
            <DialogDescription>
              {actionResult?.summary || actionProgress?.message || 'Action completed.'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Summary info - fixed header section */}
          {actionResult && (
            <div className="flex-shrink-0 space-y-3 text-sm">
              {/* Profile and timestamp */}
              <div className="flex items-center justify-between text-muted-foreground">
                {actionResult.profile && (
                  <span>Profile: <span className="text-foreground font-medium">{actionResult.profile}</span></span>
                )}
                {actionResult.timestamp && (
                  <span>{formatRelativeTime(actionResult.timestamp)}</span>
                )}
              </div>
              
              {/* Filter pills - clickable to filter the list */}
              {actionResult.counts && (
                <div className="flex flex-wrap gap-2 text-xs" role="tablist" aria-label="Filter by status">
                  {actionResult.counts.installed !== undefined && actionResult.counts.installed > 0 && (
                    <button
                      role="tab"
                      aria-selected={detailsFilter === 'installed'}
                      onClick={() => setDetailsFilter(detailsFilter === 'installed' ? null : 'installed')}
                      className={`px-2 py-1 rounded cursor-pointer transition-opacity ${
                        detailsFilter === 'installed' ? 'ring-2 ring-success' : ''
                      } ${detailsFilter && detailsFilter !== 'installed' ? 'opacity-50' : ''} ${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                    >
                      Installed: {actionResult.counts.installed}
                    </button>
                  )}
                  {actionResult.counts.toInstall !== undefined && actionResult.counts.toInstall > 0 && (
                    <button
                      role="tab"
                      aria-selected={detailsFilter === 'to_install'}
                      onClick={() => setDetailsFilter(detailsFilter === 'to_install' ? null : 'to_install')}
                      className={`px-2 py-1 rounded cursor-pointer transition-opacity whitespace-nowrap flex-shrink-0 ${
                        detailsFilter === 'to_install' ? `ring-2 ${getColorClasses('action').border}` : ''
                      } ${detailsFilter && detailsFilter !== 'to_install' ? 'opacity-50' : ''} ${getColorClasses('action').bg} ${getColorClasses('action').text}`}
                    >
                      To install: {actionResult.counts.toInstall}
                    </button>
                  )}
                  {actionResult.counts.alreadyPresent !== undefined && actionResult.counts.alreadyPresent > 0 && (
                    <button
                      role="tab"
                      aria-selected={detailsFilter === 'present'}
                      onClick={() => setDetailsFilter(detailsFilter === 'present' ? null : 'present')}
                      className={`px-2 py-1 rounded cursor-pointer transition-opacity ${
                        detailsFilter === 'present' ? 'ring-2 ring-success' : ''
                      } ${detailsFilter && detailsFilter !== 'present' ? 'opacity-50' : ''} ${getColorClasses('success').bg} ${getColorClasses('success').text}`}
                    >
                      Already present: {actionResult.counts.alreadyPresent}
                    </button>
                  )}
                  {actionResult.counts.skipped !== undefined && actionResult.counts.skipped > 0 && (
                    <button
                      role="tab"
                      aria-selected={detailsFilter === 'skipped'}
                      onClick={() => setDetailsFilter(detailsFilter === 'skipped' ? null : 'skipped')}
                      className={`px-2 py-1 rounded cursor-pointer transition-opacity ${
                        detailsFilter === 'skipped' ? 'ring-2 ring-warning' : ''
                      } ${detailsFilter && detailsFilter !== 'skipped' ? 'opacity-50' : ''} ${getColorClasses('warn').bg} ${getColorClasses('warn').text}`}
                    >
                      Skipped: {actionResult.counts.skipped}
                    </button>
                  )}
                  {actionResult.counts.failed !== undefined && actionResult.counts.failed > 0 && (
                    <button
                      role="tab"
                      aria-selected={detailsFilter === 'failed'}
                      onClick={() => setDetailsFilter(detailsFilter === 'failed' ? null : 'failed')}
                      className={`px-2 py-1 rounded cursor-pointer transition-opacity ${
                        detailsFilter === 'failed' ? 'ring-2 ring-danger' : ''
                      } ${detailsFilter && detailsFilter !== 'failed' ? 'opacity-50' : ''} ${getColorClasses('error').bg} ${getColorClasses('error').text}`}
                    >
                      Failed: {actionResult.counts.failed}
                    </button>
                  )}
                  {actionResult.counts.missing !== undefined && actionResult.counts.missing > 0 && (
                    <button
                      role="tab"
                      aria-selected={detailsFilter === 'to_install'}
                      onClick={() => setDetailsFilter(detailsFilter === 'to_install' ? null : 'to_install')}
                      className={`px-2 py-1 rounded cursor-pointer transition-opacity ${
                        detailsFilter === 'to_install' ? `ring-2 ${getColorClasses('warn').border}` : ''
                      } ${detailsFilter && detailsFilter !== 'to_install' ? 'opacity-50' : ''} ${getColorClasses('warn').bg} ${getColorClasses('warn').text}`}
                    >
                      Missing: {actionResult.counts.missing}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* App events list - scrollable section with proper constraints */}
          {actionResult?.appEvents && actionResult.appEvents.length > 0 && (() => {
            // Filter out phase header events from the list
            const itemEvents = actionResult.appEvents.filter(e => 
              e.app !== '── APPLY ──' && e.app !== '── VERIFY ──'
            );
            
            // Derive canonical statusKey for each event (same logic as list rendering)
            const deriveStatusKey = (e: AppEvent): StatusKey => {
              return e.statusKey || (
                e.action === 'OK' ? 'present' :
                e.action === 'Installed' ? 'installed' :
                e.action === 'Failed' ? 'failed' :
                e.action === 'Skipped' ? 'skipped' :
                e.action === 'Cancelled' ? 'cancelled' :
                e.action === 'Processing' ? 'installing' :
                e.action === 'To install' || e.action === 'Missing' ? 'to_install' :
                e.action === 'Captured' ? 'detected' :
                'skipped'
              );
            };
            
            // Filter events based on selected filter (using canonical statusKey)
            const filteredEvents = detailsFilter
              ? itemEvents.filter(e => deriveStatusKey(e) === detailsFilter)
              : itemEvents;
            
            // Sort: failed/missing first, then to_install, then installed, then OK/skipped/others
            const sortedEvents = [
              ...filteredEvents.filter(e => e.statusKey === 'failed' || e.action === 'Failed'),
              ...filteredEvents.filter(e => (e.statusKey === 'to_install' && e.phase === 'verify') || e.action === 'Missing'),
              ...filteredEvents.filter(e => e.statusKey === 'to_install' && e.phase !== 'verify'),
              ...filteredEvents.filter(e => e.statusKey === 'installed' || e.action === 'Installed'),
              ...filteredEvents.filter(e => e.statusKey === 'present' || e.action === 'OK'),
              ...filteredEvents.filter(e => !['failed', 'to_install', 'installed', 'present'].includes(e.statusKey || '') && !['Failed', 'Missing', 'Installed', 'OK'].includes(e.action)),
            ];
            
            // Deduplicate sorted events (in case of overlapping filters)
            const seenApps = new Set<string>();
            const uniqueSortedEvents = sortedEvents.filter(e => {
              if (seenApps.has(e.app)) return false;
              seenApps.add(e.app);
              return true;
            });
            
            // Calculate totals: use manifestTotal if available, otherwise show count only
            const manifestTotal = actionResult.counts?.manifestTotal;
            const shownCount = uniqueSortedEvents.length;
            
            
            return (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-shrink-0 mb-2">
                  <p className="text-xs text-muted-foreground">
                    {manifestTotal !== undefined 
                      ? `Apps (${shownCount} of ${manifestTotal})`
                      : `Apps (${shownCount})`}
                  </p>
                </div>
                <div className="flex-1 min-h-0 max-h-[55vh] overflow-y-auto rounded-md border border-border">
                  <div className="divide-y divide-border">
                    {uniqueSortedEvents.map((event, i) => {
                      // Use canonical statusKey derivation (same as filter logic)
                      const statusKey = deriveStatusKey(event);
                      // Use phase-aware status with reason for correct labels per phase
                      const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: event.phase, reason: event.reason });
                      const colors = getColorClasses(uiStatus.color);
                      
                      return (
                        <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                          <span className="font-mono truncate flex-1">{event.app}</span>
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap min-w-fit ${colors.bg} ${colors.text}`}>
                            {/* Use long label for modal display */}
                            {uiStatus.longLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Fallback if no app events */}
          {(!actionResult?.appEvents || actionResult.appEvents.length === 0) && actionResult?.status === 'success' && (
            <div className="flex-shrink-0 text-sm text-muted-foreground py-4 text-center">
              {actionResult.action === 'capture' && actionResult.counts?.total === 0 
                ? 'No applications were detected on this computer.'
                : 'Operation completed successfully.'}
            </div>
          )}
          
          {actionResult?.status === 'error' && (
            <div className="flex-shrink-0 text-sm py-4 text-center">
              {actionResult.counts?.failed && actionResult.counts.failed > 0 && (actionResult.counts.installed || actionResult.counts.alreadyPresent) ? (
                // Partial failure: show summary, not generic error
                <div className="text-warning">
                  <p className="font-medium">Completed with issues</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {actionResult.counts.installed || 0} installed • {actionResult.counts.alreadyPresent || 0} already present • {actionResult.counts.failed} failed
                  </p>
                </div>
              ) : (
                // Fatal error
                <p className="text-danger">An error occurred during the operation.</p>
              )}
            </div>
          )}

          <DialogFooter className="flex-shrink-0 pt-4 gap-2">
            <Button onClick={() => setDetailsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Profiles Modal */}
      <ManageProfilesModal
        open={manageProfilesOpen}
        onOpenChange={setManageProfilesOpen}
        profiles={profiles}
        selectedProfile={selectedProfile}
        profilesDirectory={profilesDirectory}
        pendingCaptureDraftPath={pendingCaptureDraftPath}
        onRenameDisplay={(path, currentName) => {
          onRenameProfile?.(path, currentName);
        }}
        onDelete={(path, displayName) => {
          onDeleteProfile?.(path, displayName);
        }}
        onSetActive={(profile) => {
          onSetActiveProfile?.(profile);
        }}
        onOpenFolder={onOpenProfilesFolder}
        onRefresh={onRefreshProfiles}
      />

      {/* View Apps Modal - for draft/saved profile details */}
      <ViewAppsModal
        open={viewProfilePath !== null}
        onOpenChange={(open) => !open && setViewProfilePath(null)}
        profilePath={viewProfilePath || ''}
        profileDisplayName={viewProfileName}
      />
    </div>
  );
}
