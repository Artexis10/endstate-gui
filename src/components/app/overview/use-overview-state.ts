/**
 * useOverviewState - State management hook for Overview Screen
 */

import { useState, useEffect, useRef } from 'react';
import type { ActionType, ActiveFlow, SetupIntent, ActionProgress } from './types';

interface UseOverviewStateProps {
  isRunning: boolean;
  runningAction: ActionType;
  initialExpandedCard?: ActionType;
  actionProgress: ActionProgress | null;
  onClearExpandedCard?: () => void;
  onCapture: () => void;
  onSetup: (intent: SetupIntent) => void;
  onCheck: () => void;
  onDismissResult: (action?: 'capture' | 'setup' | 'check') => void;
}

interface UseOverviewStateReturn {
  // State
  activeFlow: ActiveFlow;
  setActiveFlow: (flow: ActiveFlow) => void;
  setupIntent: SetupIntent;
  setSetupIntent: (intent: SetupIntent) => void;
  detailsModalOpen: boolean;
  setDetailsModalOpen: (open: boolean) => void;
  activityExpanded: boolean;
  setActivityExpanded: (expanded: boolean) => void;
  manageProfilesOpen: boolean;
  setManageProfilesOpen: (open: boolean) => void;
  viewProfilePath: string | null;
  setViewProfilePath: (path: string | null) => void;
  isAtBottom: boolean;
  setIsAtBottom: (atBottom: boolean) => void;
  userHasScrolledAway: boolean;
  setUserHasScrolledAway: (scrolledAway: boolean) => void;

  // Refs
  activityScrollRef: React.RefObject<HTMLDivElement>;
  liveActivityContainerRef: React.RefObject<HTMLDivElement>;

  // Handlers
  handleExecuteAction: (action: ActionType) => void;
  handleDismiss: (action: 'capture' | 'setup' | 'check') => void;
}

function actionToFlow(action: ActionType): ActiveFlow {
  if (action === 'capture') return 'capture';
  if (action === 'setup' || action === 'check') return 'setup';
  return 'none';
}

export function useOverviewState({
  isRunning,
  runningAction,
  initialExpandedCard,
  actionProgress,
  onClearExpandedCard,
  onCapture,
  onSetup,
  onCheck,
  onDismissResult,
}: UseOverviewStateProps): UseOverviewStateReturn {
  // Initialize activeFlow: if a run is active or has results (runningAction set), start in the corresponding flow
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(() => {
    if (runningAction) return actionToFlow(runningAction);
    if (initialExpandedCard) return actionToFlow(initialExpandedCard);
    return 'none';
  });
  const [setupIntent, setSetupIntent] = useState<SetupIntent>('preview');
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [manageProfilesOpen, setManageProfilesOpen] = useState(false);
  const [viewProfilePath, setViewProfilePath] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [lastSeenPhase, setLastSeenPhase] = useState<string | undefined>(undefined);
  const [userHasScrolledAway, setUserHasScrolledAway] = useState(false);

  // Refs
  const activityScrollRef = useRef<HTMLDivElement>(null);
  const liveActivityContainerRef = useRef<HTMLDivElement>(null);

  // Handle external initialExpandedCard changes (e.g., from redirect)
  useEffect(() => {
    if (initialExpandedCard) {
      setActiveFlow(actionToFlow(initialExpandedCard));
      onClearExpandedCard?.();
    }
  }, [initialExpandedCard, onClearExpandedCard]);

  // Sync activeFlow when returning to Overview during an active run
  useEffect(() => {
    if (isRunning && runningAction) {
      setActiveFlow(actionToFlow(runningAction));
    }
  }, [isRunning, runningAction]);

  // Reset activity expanded state when a new run starts
  useEffect(() => {
    if (isRunning && runningAction) {
      setActivityExpanded(false);
      setIsAtBottom(true);
      setUserHasScrolledAway(false);
      setLastSeenPhase(undefined);
    }
  }, [isRunning, runningAction]);

  // Auto-scroll Live Activity into view when entering VERIFY phase
  useEffect(() => {
    const currentPhase = actionProgress?.phase;
    if (
      currentPhase === 'verify' &&
      lastSeenPhase !== 'verify' &&
      activityExpanded &&
      !userHasScrolledAway &&
      liveActivityContainerRef.current
    ) {
      liveActivityContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    setLastSeenPhase(currentPhase);
  }, [actionProgress?.phase, lastSeenPhase, activityExpanded, userHasScrolledAway]);

  // Escape key returns to flow selection (when not running)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRunning) {
        if (activeFlow !== 'none') {
          setActiveFlow('none');
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeFlow, isRunning]);

  // Execute action from expanded card
  const handleExecuteAction = (action: ActionType) => {
    if (!action) return;

    if (action === 'capture') {
      onCapture();
    } else if (action === 'setup') {
      onSetup(setupIntent);
    } else if (action === 'check') {
      onCheck();
    }
  };

  // Dismiss result
  const handleDismiss = (action: 'capture' | 'setup' | 'check') => {
    onDismissResult(action);
  };

  return {
    // State
    activeFlow,
    setActiveFlow,
    setupIntent,
    setSetupIntent,
    detailsModalOpen,
    setDetailsModalOpen,
    activityExpanded,
    setActivityExpanded,
    manageProfilesOpen,
    setManageProfilesOpen,
    viewProfilePath,
    setViewProfilePath,
    isAtBottom,
    setIsAtBottom,
    userHasScrolledAway,
    setUserHasScrolledAway,

    // Refs
    activityScrollRef,
    liveActivityContainerRef,

    // Handlers
    handleExecuteAction,
    handleDismiss,
  };
}
