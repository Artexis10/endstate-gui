/**
 * useOverviewState - State management hook for Overview Screen
 */

import { useState, useEffect, useRef } from 'react';
import type { ActionType, SetupIntent, ActionProgress } from './types';

interface UseOverviewStateProps {
  isRunning: boolean;
  runningAction: ActionType;
  initialExpandedCard?: ActionType;
  actionProgress: ActionProgress | null;
  onClearExpandedCard?: () => void;
  onCapture: () => void;
  onSetup: (intent: SetupIntent) => void;
  onCheck: () => void;
  onDismissResult: () => void;
}

interface UseOverviewStateReturn {
  // State
  expandedCard: ActionType;
  setExpandedCard: (card: ActionType) => void;
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
  captureCardRef: React.RefObject<HTMLDivElement>;
  setupCardRef: React.RefObject<HTMLDivElement>;
  checkCardRef: React.RefObject<HTMLDivElement>;
  
  // Handlers
  handleCardClick: (action: ActionType) => void;
  handleExecuteAction: (action: ActionType) => void;
  handleDismiss: () => void;
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
  // Initialize expandedCard: prioritize active running action, then initialExpandedCard, then null
  // This ensures returning to Overview during an active run shows the correct expanded card
  const [expandedCard, setExpandedCard] = useState<ActionType>(() => {
    if (isRunning && runningAction) return runningAction;
    return initialExpandedCard ?? null;
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
  const captureCardRef = useRef<HTMLDivElement>(null);
  const setupCardRef = useRef<HTMLDivElement>(null);
  const checkCardRef = useRef<HTMLDivElement>(null);
  
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
      setExpandedCard(null);
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

  return {
    // State
    expandedCard,
    setExpandedCard,
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
    captureCardRef,
    setupCardRef,
    checkCardRef,
    
    // Handlers
    handleCardClick,
    handleExecuteAction,
    handleDismiss,
  };
}
