/**
 * Overview (Home) Screen
 *
 * ADR-001 ARCHIVE NOTE: This screen is no longer the default entry point.
 * The app now opens to IntentLanding (src/components/app/intent/intent-landing.tsx).
 * This component is retained for backward compatibility with existing tests
 * and may be reintroduced for advanced/power-user workflows.
 *
 * Previously: The default landing page surfacing primary actions via
 * FlowSelector (Capture, Set up), current profile, and recent activity.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useOverviewState } from './use-overview-state';
import { buildRecentActivity } from './selectors';
import {
  ActionDetailsModal,
  ActionExpandedContent,
  FlowSelector,
  RecentActivityCard,
} from './components';
import { ManageProfilesModal } from '../manage-profiles-modal';
import { ViewAppsModal } from '../view-apps-modal';
import type { OverviewScreenProps } from './types';

export function OverviewScreen({
  lifecycleState,
  selectedProfile,
  profiles,
  profilesDirectory,
  isRunning,
  runningAction,
  actionProgress,
  actionStatusByAction,
  actionProgressByAction,
  actionResultByAction,
  liveAppEvents = [],
  liveCounters: _liveCounters,
  initialExpandedCard,
  lastSavedProfileSummary,
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
  pendingCaptureDraft,
  sidebarVisible,
  engineConnected = true,
}: OverviewScreenProps) {
  const hasProfile = !!selectedProfile && profiles.length > 0;

  const [detailsAction, setDetailsAction] = useState<'capture' | 'setup' | 'check' | null>(null);

  const {
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
    setUserHasScrolledAway,
    activityScrollRef,
    liveActivityContainerRef,
    handleExecuteAction,
    handleDismiss,
  } = useOverviewState({
    isRunning,
    runningAction,
    initialExpandedCard,
    actionProgress,
    onClearExpandedCard,
    onCapture,
    onSetup,
    onCheck,
    onDismissResult,
  });

  // Auto-scroll when new events are revealed, but only if user is following
  const currentPhase = runningAction ? actionProgressByAction[runningAction]?.phase : undefined;
  useEffect(() => {
    if (isAtBottom && activityScrollRef.current && activityExpanded) {
      const container = activityScrollRef.current;
      // During verify, track the last verified event (mid-list, not absolute bottom)
      if (currentPhase === 'verify') {
        const verifyEvents = container.querySelectorAll('div[data-phase="verify"]');
        if (verifyEvents.length > 0) {
          const lastEvent = verifyEvents[verifyEvents.length - 1] as HTMLElement;
          const eventRect = lastEvent.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const diff = eventRect.bottom - containerRect.bottom;
          if (diff > 0) {
            container.scrollTop += diff;
          }
          return;
        }
      }
      // Default (apply, capture, etc.): pin to absolute bottom
      container.scrollTop = container.scrollHeight;
    }
  }, [liveAppEvents, isAtBottom, activityExpanded, currentPhase]);

  const recentActivity = buildRecentActivity(lifecycleState);

  // Handler for "Back" / "Close" from within the flow
  const handleFlowBack = () => {
    if (isRunning) return;
    setActiveFlow('none');
  };

  // Build action content slots for FlowSelector
  const captureActionSlot = (
    <ActionExpandedContent
      action="capture"
      lifecycleState={lifecycleState}
      isRunning={isRunning}
      runningAction={runningAction}
      actionStatusByAction={actionStatusByAction}
      actionProgressByAction={actionProgressByAction}
      actionResultByAction={actionResultByAction}
      hasProfile={hasProfile}
      setupIntent={setupIntent}
      setSetupIntent={setSetupIntent}
      liveAppEvents={liveAppEvents}
      activityExpanded={activityExpanded}
      setActivityExpanded={setActivityExpanded}
      isAtBottom={isAtBottom}
      setIsAtBottom={setIsAtBottom}
      setUserHasScrolledAway={setUserHasScrolledAway}
      activityScrollRef={activityScrollRef}
      liveActivityContainerRef={liveActivityContainerRef}
      onExecuteAction={handleExecuteAction}
      onDismiss={() => handleDismiss('capture')}
      onDismissResult={onDismissResult}
      onSetup={onSetup}
      onCapture={onCapture}
      onShowDetails={() => {
        setDetailsAction('capture');
        setDetailsModalOpen(true);
      }}

      pendingCaptureDraft={pendingCaptureDraft}
      lastSavedProfileSummary={lastSavedProfileSummary}
      onSaveProfile={onSaveProfile}
      onDiscardDraft={onDiscardDraft}
    />
  );

  const setupActionSlot = (
    <ActionExpandedContent
      action="setup"
      lifecycleState={lifecycleState}
      isRunning={isRunning}
      runningAction={runningAction}
      actionStatusByAction={actionStatusByAction}
      actionProgressByAction={actionProgressByAction}
      actionResultByAction={actionResultByAction}
      hasProfile={hasProfile}
      setupIntent={setupIntent}
      setSetupIntent={setSetupIntent}
      liveAppEvents={liveAppEvents}
      activityExpanded={activityExpanded}
      setActivityExpanded={setActivityExpanded}
      isAtBottom={isAtBottom}
      setIsAtBottom={setIsAtBottom}
      setUserHasScrolledAway={setUserHasScrolledAway}
      activityScrollRef={activityScrollRef}
      liveActivityContainerRef={liveActivityContainerRef}
      onExecuteAction={handleExecuteAction}
      onDismiss={() => handleDismiss('setup')}
      onDismissResult={onDismissResult}
      onSetup={onSetup}
      onCapture={onCapture}
      onShowDetails={() => {
        setDetailsAction('setup');
        setDetailsModalOpen(true);
      }}

    />
  );

  return (
    <div className="space-y-8">
      {/* Welcome Header - shown only when sidebar is hidden and no flow active */}
      {!sidebarVisible && activeFlow === 'none' && (
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Endstate</h1>
          <p className="text-sm text-muted-foreground">
            Save your setup or set up a new machine
          </p>
        </div>
      )}

      {/* Flow Selector - always shown as the primary action hub */}
      <AnimatePresence mode="wait">
        <FlowSelector
          activeFlow={activeFlow}
          setActiveFlow={setActiveFlow}
          profiles={profiles}
          selectedProfile={selectedProfile}
          hasProfile={hasProfile}
          engineConnected={engineConnected}
          isRunning={isRunning}
          onProfileChange={onProfileChange}
          onOpenProfilesFolder={onOpenProfilesFolder}
          onRefreshProfiles={onRefreshProfiles}
          onManageProfiles={() => setManageProfilesOpen(true)}
          onBack={handleFlowBack}
          captureActionSlot={captureActionSlot}
          setupActionSlot={setupActionSlot}
        />
      </AnimatePresence>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <RecentActivityCard
          activities={recentActivity as any}
          onNavigate={onNavigate}
        />
      )}

      {/* Details Modal - shows logs/results without navigation */}
      <ActionDetailsModal
        open={detailsModalOpen}
        onOpenChange={(open) => {
          setDetailsModalOpen(open);
          if (!open) setDetailsAction(null);
        }}
        actionResult={detailsAction ? actionResultByAction[detailsAction] : null}
        actionProgress={detailsAction ? actionProgressByAction[detailsAction] : null}
      />

      {/* Manage Profiles Modal */}
      <ManageProfilesModal
        open={manageProfilesOpen}
        onOpenChange={setManageProfilesOpen}
        profiles={profiles}
        selectedProfile={selectedProfile}
        profilesDirectory={profilesDirectory}
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
        profileDisplayName=""
      />
    </div>
  );
}
