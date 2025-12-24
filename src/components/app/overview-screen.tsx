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

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ScanSearch, 
  PlayCircle, 
  CheckCircle,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRelativeTime, type LifecycleState, type LifecycleEvent } from '@/lib/lifecycle-state';
import type { DiscoveredProfile } from '@/file-discovery';
import type { UIMode } from '@/lib/ui-mode';

type ActionType = 'capture' | 'setup' | 'check' | null;
type ActionStatus = 'idle' | 'running' | 'success' | 'error';

interface ActionProgress {
  message: string;
  detail?: string;
}

interface OverviewScreenProps {
  lifecycleState: LifecycleState;
  selectedProfile: string;
  profiles: DiscoveredProfile[];
  isRunning: boolean;
  runningAction: ActionType;
  actionStatus: ActionStatus;
  actionProgress: ActionProgress | null;
  uiMode: UIMode;
  onNavigate: (page: 'capture' | 'apply' | 'verify' | 'report' | 'settings') => void;
  onCapture: () => void;
  onSetup: () => void;
  onCheck: () => void;
  onProfileChange: (profile: string, path: string) => void;
  onDismissResult: () => void;
}

export function OverviewScreen({
  lifecycleState,
  selectedProfile,
  profiles,
  isRunning,
  runningAction,
  actionStatus,
  actionProgress,
  uiMode,
  onNavigate,
  onCapture,
  onSetup,
  onCheck,
  onProfileChange,
  onDismissResult,
}: OverviewScreenProps) {
  const [expandedCard, setExpandedCard] = useState<ActionType>(null);
  const hasProfile = !!selectedProfile && profiles.length > 0;
  
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
        onSetup();
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
  const contentVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: { 
      opacity: 1, 
      height: 'auto',
      transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const }
    },
    exit: { 
      opacity: 0, 
      height: 0,
      transition: { duration: 0.15, ease: [0.4, 0, 1, 1] as const }
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
      setup: 'Install applications from your selected profile. Preview changes first to see what will be installed.',
      check: 'Compare your computer against the selected profile to see what\'s installed and what\'s missing.',
    };

    // Action-specific button labels
    const buttonLabels: Record<NonNullable<ActionType>, { idle: string; running: string }> = {
      capture: { idle: 'Start capture', running: 'Capturing...' },
      setup: { idle: 'Preview changes', running: 'Analyzing...' },
      check: { idle: 'Check now', running: 'Checking...' },
    };

    if (!action) return null;

    return (
      <motion.div
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="border-t border-border mt-3 pt-4 space-y-4"
      >
        {/* Description */}
        <p className="text-sm text-muted-foreground">
          {descriptions[action]}
        </p>

        {/* Last run info */}
        {lastEvent && !isThisRunning && !isThisComplete && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
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
          <div className="flex items-center gap-3 bg-primary/5 rounded-md px-3 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{actionProgress.message}</p>
              {actionProgress.detail && (
                <p className="text-xs text-muted-foreground truncate">{actionProgress.detail}</p>
              )}
            </div>
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

        {/* Error state */}
        {isThisComplete && actionStatus === 'error' && (
          <div className="flex items-center gap-3 bg-destructive/10 rounded-md px-3 py-3">
            <XCircle className="h-4 w-4 text-destructive" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Something went wrong</p>
              {actionProgress?.message && (
                <p className="text-xs text-muted-foreground">{actionProgress.message}</p>
              )}
            </div>
          </div>
        )}

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
                    {buttonLabels[action].running}
                  </>
                ) : (
                  buttonLabels[action].idle
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
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  const page = action === 'capture' ? 'capture' : action === 'setup' ? 'apply' : 'verify';
                  onNavigate(page);
                }}
              >
                View details
                <ExternalLink className="h-3 w-3 ml-1" />
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
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Current Profile</p>
                  <p className="text-xs text-muted-foreground">{selectedProfile}</p>
                </div>
              </div>
              <select
                value={selectedProfile}
                onChange={(e) => {
                  const selected = profiles.find(p => p.name === e.target.value);
                  onProfileChange(e.target.value, selected?.path || '');
                }}
                disabled={isRunning}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {profiles.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
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
    </div>
  );
}
