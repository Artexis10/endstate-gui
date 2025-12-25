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
 * In Default mode, action cards expand in-place to execute actions.
 * In Advanced mode, cards navigate to their respective pages.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  FolderOpen,
  RefreshCw
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
import type { UIMode } from '@/lib/ui-mode';

type ActionType = 'capture' | 'setup' | 'check' | null;
type ActionStatus = 'idle' | 'running' | 'success' | 'error';
type SetupIntent = 'preview' | 'apply';

interface ActionProgress {
  message: string;
  detail?: string;
}

// Per-app event for detailed tracking
interface AppEvent {
  app: string;
  action: string;
  timestamp?: number;
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
  uiMode: UIMode;
  onNavigate: (page: 'capture' | 'apply' | 'verify' | 'report' | 'settings') => void;
  onCapture: () => void;
  onSetup: (intent: SetupIntent) => void;
  onCheck: () => void;
  onProfileChange: (profile: string, path: string) => void;
  onDismissResult: () => void;
  onOpenProfilesFolder: () => void;
  onRefreshProfiles: () => void;
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
  uiMode,
  onNavigate,
  onCapture,
  onSetup,
  onCheck,
  onProfileChange,
  onDismissResult,
  onOpenProfilesFolder,
  onRefreshProfiles,
}: OverviewScreenProps) {
  const [expandedCard, setExpandedCard] = useState<ActionType>(null);
  const [setupIntent, setSetupIntent] = useState<SetupIntent>('preview');
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  // Activity collapsed by default in Default mode, expanded in Advanced mode
  // Reset when a new run starts based on mode
  const [activityExpanded, setActivityExpanded] = useState(uiMode === 'advanced');
  const hasProfile = !!selectedProfile && profiles.length > 0;
  
  // Reset activity expanded state when a new run starts
  useEffect(() => {
    if (isRunning && runningAction) {
      // Default mode: collapse for calm UI; Advanced mode: expand to show details
      setActivityExpanded(uiMode === 'advanced');
    }
  }, [isRunning, runningAction, uiMode]);
  
  // Handle card click based on UI mode
  const handleCardClick = (action: ActionType) => {
    if (isRunning) return;
    
    if (uiMode === 'advanced') {
      // In advanced mode, navigate to the page
      switch (action) {
        case 'capture':
          onNavigate('capture');
          break;
        case 'setup':
          if (hasProfile) onNavigate('apply');
          break;
        case 'check':
          if (hasProfile) onNavigate('verify');
          break;
      }
    } else {
      // In default mode, toggle card expansion
      if (expandedCard === action) {
        // Only collapse if not running and not showing result
        if (actionStatus === 'idle') {
          setExpandedCard(null);
        }
      } else {
        setExpandedCard(action);
      }
    }
  };

  // Execute action from expanded card
  const handleExecuteAction = (action: ActionType) => {
    switch (action) {
      case 'capture':
        onCapture();
        break;
      case 'setup':
        onSetup(setupIntent);
        break;
      case 'check':
        onCheck();
        break;
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

  // Card expansion animation variants
  // Simplified animation - use opacity only, let layout handle height
  const contentVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] as const }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.1, ease: [0.4, 0, 1, 1] as const }
    },
  };

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
        if (running) return setupIntent === 'preview' ? 'Previewing...' : 'Applying...';
        return setupIntent === 'preview' ? 'Preview changes' : 'Apply changes';
      }
      return running ? 'Checking...' : 'Check now';
    };

    if (!action) return null;

    return (
      <motion.div
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="border-t border-border mt-3 pt-4 space-y-3 pb-4"
      >
        {/* Description */}
        <p className="text-sm text-muted-foreground">
          {descriptions[action]}
        </p>

        {/* Profile selector for Check and Setup cards */}
        {(action === 'check' || action === 'setup') && hasProfile && !isThisRunning && !isThisComplete && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-muted/50 rounded-md px-3 py-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Profile</p>
                <Select
                  value={selectedProfile}
                  onValueChange={(value) => {
                    const selected = profiles.find(p => p.name === value);
                    onProfileChange(value, selected?.path || '');
                  }}
                  disabled={isRunning}
                >
                  <SelectTrigger className="h-7 border-0 p-0 focus:ring-0 bg-transparent text-sm font-medium">
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
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-3">
              <span className="flex-1 truncate" title={profilesDirectory}>
                Profiles folder: {profilesDirectory}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenProfilesFolder();
                }}
                disabled={isRunning}
              >
                <FolderOpen className="h-3 w-3 mr-1" />
                Open
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefreshProfiles();
                }}
                disabled={isRunning}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

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

        {/* Running state */}
        {isThisRunning && actionProgress && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-primary/5 rounded-md px-3 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{actionProgress.message}</p>
                {actionProgress.detail && (
                  <p className="text-xs text-muted-foreground truncate">{actionProgress.detail}</p>
                )}
              </div>
            </div>
            
            {/* Collapsible live activity for Setup card */}
            {action === 'setup' && liveAppEvents.length > 0 && (
              <div className="rounded-md border border-border/50">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivityExpanded(!activityExpanded);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  <span className="font-medium">Live activity</span>
                  <div className="flex items-center gap-2">
                    {liveCounters && (
                      <span className="flex items-center gap-1.5">
                        {liveCounters.installed > 0 && <span className="text-green-600">✓{liveCounters.installed}</span>}
                        {liveCounters.alreadyPresent > 0 && <span className="text-muted-foreground">●{liveCounters.alreadyPresent}</span>}
                        {liveCounters.skipped > 0 && <span className="text-yellow-600">⊘{liveCounters.skipped}</span>}
                        {liveCounters.failed > 0 && <span className="text-red-600">✗{liveCounters.failed}</span>}
                      </span>
                    )}
                    {activityExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </div>
                </button>
                {activityExpanded && (
                  <div className="px-3 pb-3 space-y-1 border-t border-border/50 max-h-56 overflow-y-auto">
                    {liveAppEvents.slice(-10).map((event) => (
                      <div key={`${event.app}-${event.timestamp}`} className="flex items-center gap-2 text-xs pt-1.5">
                        <span className={`w-14 text-right font-medium ${
                          event.action === 'Installed' ? 'text-green-600' :
                          event.action === 'Failed' ? 'text-red-600' :
                          event.action === 'OK' ? 'text-muted-foreground' :
                          event.action === 'Skipped' ? 'text-yellow-600' :
                          event.action === 'Cancelled' ? 'text-yellow-600' :
                          event.action === 'Processing' ? 'text-blue-600' :
                          'text-muted-foreground'
                        }`}>
                          {event.action === 'OK' ? 'PRESENT' : 
                           event.action === 'Skipped' ? 'SKIPPED' : 
                           event.action === 'Cancelled' ? 'CANCEL' :
                           event.action === 'Processing' ? 'WORKING' : 
                           event.action.toUpperCase().slice(0, 7)}
                        </span>
                        <span className="font-mono truncate flex-1">{event.app}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Success state */}
        {isThisComplete && actionStatus === 'success' && (
          <div className="flex items-center gap-3 bg-success/10 rounded-md px-3 py-3">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <div className="flex-1">
              <p className="text-sm font-medium text-success">Completed successfully</p>
              {actionProgress?.message && (
                <p className="text-xs text-muted-foreground">{actionProgress.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Error state - distinguish partial failures from hard errors */}
        {isThisComplete && actionStatus === 'error' && (
          <div className="flex items-center gap-3 bg-destructive/10 rounded-md px-3 py-3">
            <XCircle className="h-4 w-4 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">
                {actionResult?.counts?.failed && actionResult.counts.failed > 0
                  ? `Some apps failed to install (${actionResult.counts.failed} failed)`
                  : 'Something went wrong'}
              </p>
              {actionProgress?.message && (
                <p className="text-xs text-muted-foreground">{actionProgress.message}</p>
              )}
            </div>
          </div>
        )}

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
                Done
              </Button>
              {/* Show "Apply changes" button after successful Preview */}
              {action === 'setup' && actionResult?.wasPreview && actionStatus === 'success' && (
                <Button
                  size="sm"
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
            </>
          )}
        </div>
      </motion.div>
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
          <CardContent className="pt-4 pb-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Current Profile</p>
                  <p className="text-xs text-muted-foreground">
                    {profiles.find(p => p.name === selectedProfile)?.displayName 
                      ? `${profiles.find(p => p.name === selectedProfile)?.displayName} (${selectedProfile})`
                      : selectedProfile}
                  </p>
                </div>
              </div>
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
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex-1 truncate" title={profilesDirectory}>
                Profiles folder: {profilesDirectory}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={onOpenProfilesFolder}
                disabled={isRunning}
              >
                <FolderOpen className="h-3 w-3 mr-1" />
                Open
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={onRefreshProfiles}
                disabled={isRunning}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Primary Actions - Expandable Cards */}
      <div className="space-y-4">
        {/* Capture Card */}
        <motion.div layout transition={{ duration: 0.2, ease: 'easeInOut' }}>
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              expandedCard === 'capture' 
                ? 'border-blue-500/50 shadow-md' 
                : 'hover:border-primary/30'
            } ${isCardDisabled('capture') ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleCardClick('capture')}
          >
            <CardHeader className="pb-2">
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
                {uiMode === 'default' && (
                  <motion.div
                    animate={{ rotate: expandedCard === 'capture' ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                )}
                {uiMode === 'advanced' && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <AnimatePresence>
              {expandedCard === 'capture' && uiMode === 'default' && (
                <CardContent className="pt-0">
                  {renderExpandedContent('capture')}
                </CardContent>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* Setup Card */}
        <motion.div layout transition={{ duration: 0.2, ease: 'easeInOut' }}>
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              expandedCard === 'setup' 
                ? 'border-green-500/50 shadow-md' 
                : 'hover:border-primary/30'
            } ${isCardDisabled('setup') ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleCardClick('setup')}
          >
            <CardHeader className="pb-2">
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
                {uiMode === 'default' && (
                  <motion.div
                    animate={{ rotate: expandedCard === 'setup' ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                )}
                {uiMode === 'advanced' && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <AnimatePresence>
              {expandedCard === 'setup' && uiMode === 'default' && (
                <CardContent className="pt-0">
                  {renderExpandedContent('setup')}
                </CardContent>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* Check Card */}
        <motion.div layout transition={{ duration: 0.2, ease: 'easeInOut' }}>
          <Card 
            className={`cursor-pointer transition-all duration-200 ${
              expandedCard === 'check' 
                ? 'border-amber-500/50 shadow-md' 
                : 'hover:border-primary/30'
            } ${isCardDisabled('check') ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => handleCardClick('check')}
          >
            <CardHeader className="pb-2">
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
                {uiMode === 'default' && (
                  <motion.div
                    animate={{ rotate: expandedCard === 'check' ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                )}
                {uiMode === 'advanced' && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            <AnimatePresence>
              {expandedCard === 'check' && uiMode === 'default' && (
                <CardContent className="pt-0">
                  {renderExpandedContent('check')}
                </CardContent>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      </div>

      {/* No Profile Prompt */}
      {!hasProfile && profiles.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
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

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
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
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
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
              
              {/* Counts summary */}
              {actionResult.counts && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {actionResult.counts.total !== undefined && (
                    <span className="px-2 py-1 bg-muted rounded">Total: {actionResult.counts.total}</span>
                  )}
                  {actionResult.counts.installed !== undefined && actionResult.counts.installed > 0 && (
                    <span className="px-2 py-1 bg-green-500/10 text-green-600 rounded">Installed: {actionResult.counts.installed}</span>
                  )}
                  {actionResult.counts.toInstall !== undefined && actionResult.counts.toInstall > 0 && (
                    <span className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded">To install: {actionResult.counts.toInstall}</span>
                  )}
                  {actionResult.counts.alreadyPresent !== undefined && actionResult.counts.alreadyPresent > 0 && (
                    <span className="px-2 py-1 bg-muted rounded">Already present: {actionResult.counts.alreadyPresent}</span>
                  )}
                  {actionResult.counts.skipped !== undefined && actionResult.counts.skipped > 0 && (
                    <span className="px-2 py-1 bg-yellow-500/10 text-yellow-600 rounded">Skipped: {actionResult.counts.skipped}</span>
                  )}
                  {actionResult.counts.failed !== undefined && actionResult.counts.failed > 0 && (
                    <span className="px-2 py-1 bg-red-500/10 text-red-600 rounded">Failed: {actionResult.counts.failed}</span>
                  )}
                  {actionResult.counts.missing !== undefined && actionResult.counts.missing > 0 && (
                    <span className="px-2 py-1 bg-orange-500/10 text-orange-600 rounded">Missing: {actionResult.counts.missing}</span>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* App events list - scrollable section with proper constraints */}
          {actionResult?.appEvents && actionResult.appEvents.length > 0 && (
            <div className="flex-1 min-h-0 flex flex-col">
              <p className="flex-shrink-0 text-xs text-muted-foreground mb-2">
                Apps ({actionResult.appEvents.length})
              </p>
              <div className="flex-1 min-h-0 max-h-[55vh] overflow-y-auto rounded-md border border-border">
                <div className="divide-y divide-border">
                  {/* Show failed first, then installed, then OK/skipped/others - NO LIMIT */}
                  {[
                    ...actionResult.appEvents.filter(e => e.action === 'Failed'),
                    ...actionResult.appEvents.filter(e => e.action === 'Installed'),
                    ...actionResult.appEvents.filter(e => e.action === 'OK'),
                    ...actionResult.appEvents.filter(e => !['Failed', 'Installed', 'OK'].includes(e.action)),
                  ].map((event, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span className="font-mono truncate flex-1">{event.app}</span>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                        event.action === 'Installed' ? 'bg-green-500/10 text-green-600' :
                        event.action === 'Failed' ? 'bg-red-500/10 text-red-600' :
                        event.action === 'OK' ? 'bg-muted text-muted-foreground' :
                        event.action === 'Skipped' ? 'bg-yellow-500/10 text-yellow-600' :
                        event.action === 'Would install' || event.action === 'Missing' ? 'bg-blue-500/10 text-blue-600' :
                        event.action === 'Processing' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {/* Friendly label for OK, truthful for others */}
                        {event.action === 'OK' ? 'Already present' : event.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fallback if no app events */}
          {(!actionResult?.appEvents || actionResult.appEvents.length === 0) && actionResult?.status === 'success' && (
            <div className="flex-shrink-0 text-sm text-muted-foreground py-4 text-center">
              {actionResult.action === 'capture' && actionResult.counts?.total === 0 
                ? 'No applications were detected on this computer.'
                : 'Operation completed successfully.'}
            </div>
          )}
          
          {actionResult?.status === 'error' && (
            <div className="flex-shrink-0 text-sm text-destructive py-4 text-center">
              An error occurred during the operation.
            </div>
          )}

          <DialogFooter className="flex-shrink-0 pt-4 gap-2">
            {actionResult?.action === 'setup' && (
              <Button variant="secondary" size="sm" onClick={() => {
                setDetailsModalOpen(false);
                onNavigate('apply');
              }}>
                View full report
              </Button>
            )}
            {actionResult?.action === 'check' && (
              <Button variant="secondary" size="sm" onClick={() => {
                setDetailsModalOpen(false);
                onNavigate('verify');
              }}>
                View full report
              </Button>
            )}
            <Button onClick={() => setDetailsModalOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
