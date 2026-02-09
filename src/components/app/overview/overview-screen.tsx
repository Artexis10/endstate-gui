/**
 * Overview (Home) Screen - The default landing page for Endstate
 *
 * This screen integrates the lifecycle conceptually by surfacing:
 * - Primary actions via the FlowSelector (Capture, Set up)
 * - Current profile (if any)
 * - Recent lifecycle activity
 *
 * Non-technical users should be able to complete core tasks
 * without ever needing to navigate away from this screen.
 *
 * The FlowSelector is the primary action hub. When a flow is active,
 * action content renders inline within the flow panel via slots.
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
  liveCounters,
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

  // Auto-scroll to latest phase event when new events arrive, but only if user is following
  useEffect(() => {
    if (isAtBottom && activityScrollRef.current && activityExpanded) {
      const container = activityScrollRef.current;
      const phase = runningAction ? actionProgressByAction[runningAction]?.phase : undefined;
      if (phase) {
        const phaseEvents = container.querySelectorAll(`div[data-phase="${phase}"]`);
        if (phaseEvents.length > 0) {
          const lastEvent = phaseEvents[phaseEvents.length - 1] as HTMLElement;
          const eventRect = lastEvent.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const diff = eventRect.bottom - containerRect.bottom;
          // Only scroll down to new events — never drift upward
          if (diff > 0) {
            container.scrollTop += diff;
          }
          return;
        }
      }
      container.scrollTop = container.scrollHeight;
    }
  }, [liveAppEvents, isAtBottom, activityExpanded, runningAction, actionProgressByAction]);

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
      liveCounters={liveCounters}
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
      liveCounters={liveCounters}
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
