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

import { useEffect } from 'react';
import { ScanSearch, PlayCircle, CheckCircle } from 'lucide-react';
import { ManageProfilesModal } from '../manage-profiles-modal';
import { ViewAppsModal } from '../view-apps-modal';
import { useOverviewState } from './use-overview-state';
import { buildRecentActivity } from './selectors';
import {
  ActionCard,
  ActionDetailsModal,
  ActionExpandedContent,
  ActionResultStrip,
  CaptureStatusStrip,
  NoProfilePrompt,
  RecentActivityCard,
  SelectedProfileCard,
} from './components';
import type { OverviewScreenProps } from './types';

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
}: OverviewScreenProps) {
  const hasProfile = !!selectedProfile && profiles.length > 0;
  
  const {
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
    userHasScrolledAway: _userHasScrolledAway,
    setUserHasScrolledAway,
    activityScrollRef,
    liveActivityContainerRef,
    captureCardRef,
    setupCardRef,
    checkCardRef,
    handleCardClick,
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

  // Auto-scroll to bottom when new events arrive, but only if user is at bottom
  useEffect(() => {
    if (isAtBottom && activityScrollRef.current && activityExpanded) {
      activityScrollRef.current.scrollTop = activityScrollRef.current.scrollHeight;
    }
  }, [liveAppEvents, isAtBottom, activityExpanded]);

  // Check if a card should be disabled (another action is running)
  const isCardDisabled = (action: 'capture' | 'setup' | 'check') => {
    if (isRunning && runningAction !== action) return true;
    if (action !== 'capture' && !hasProfile) return true;
    return false;
  };

  const recentActivity = buildRecentActivity(lifecycleState);

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
        <SelectedProfileCard
          selectedProfile={selectedProfile}
          profiles={profiles}
          isRunning={isRunning}
          onProfileChange={onProfileChange}
          onManageProfiles={() => setManageProfilesOpen(true)}
        />
      )}

      {/* No Profile Prompt - appears BEFORE Primary Actions */}
      {!hasProfile && profiles.length === 0 && (
        <NoProfilePrompt isRunning={isRunning} onCapture={onCapture} />
      )}

      {/* Primary Actions - Expandable Cards */}
      <div className="space-y-6">
        {/* Primary Portal Cards */}
        <div className="space-y-4">
          {/* Capture Card - PRIMARY */}
          <ActionCard
            action="capture"
            expanded={expandedCard === 'capture'}
            disabled={isCardDisabled('capture')}
            title="Capture computer"
            description="Save your current setup as a reusable profile"
            icon={<ScanSearch className="h-5 w-5 text-blue-500" />}
            accentColor="blue"
            testId="overview-card-capture"
            cardRef={captureCardRef}
            expandedContentTestId="capture-card-expanded-content"
            onToggle={() => handleCardClick('capture')}
            collapsedStatusSlot={
              <CaptureStatusStrip
                variant="collapsed"
                pendingCaptureDraft={pendingCaptureDraft}
                lastSavedProfileSummary={lastSavedProfileSummary}
                appCount={actionResult?.counts?.total}
                onSaveProfile={onSaveProfile}
                onDiscardDraft={onDiscardDraft}
                onDismiss={handleDismiss}
                onShowDetails={() => setDetailsModalOpen(true)}
              />
            }
            expandedStatusSlot={
              <CaptureStatusStrip
                variant="expanded"
                pendingCaptureDraft={pendingCaptureDraft}
                lastSavedProfileSummary={lastSavedProfileSummary}
                appCount={actionResult?.counts?.total}
                onSaveProfile={onSaveProfile}
                onDiscardDraft={onDiscardDraft}
                onDismiss={handleDismiss}
                onShowDetails={() => setDetailsModalOpen(true)}
              />
            }
          >
            <ActionExpandedContent
              action="capture"
              lifecycleState={lifecycleState}
              isRunning={isRunning}
              runningAction={runningAction}
              actionStatus={actionStatus}
              actionProgress={actionProgress}
              actionResult={actionResult}
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
              onDismiss={handleDismiss}
              onDismissResult={onDismissResult}
              onSetup={onSetup}
              onCapture={onCapture}
              onShowDetails={() => setDetailsModalOpen(true)}
              setExpandedCard={setExpandedCard}
            />
          </ActionCard>

          {/* Setup Card - PRIMARY */}
          <ActionCard
            action="setup"
            expanded={expandedCard === 'setup'}
            disabled={isCardDisabled('setup')}
            title="Set up computer"
            description={hasProfile 
              ? 'Install apps from your saved profile'
              : 'Capture a profile first to get started'
            }
            icon={<PlayCircle className="h-5 w-5 text-green-500" />}
            accentColor="green"
            testId="overview-card-apply"
            cardRef={setupCardRef}
            expandedContentTestId="setup-card-expanded-content"
            onToggle={() => handleCardClick('setup')}
            collapsedStatusSlot={
              <ActionResultStrip
                action="setup"
                actionStatus={actionStatus}
                actionProgress={actionProgress}
                actionResult={actionResult}
                runningAction={runningAction}
                isRunning={isRunning}
                onDismiss={handleDismiss}
                onShowDetails={() => setDetailsModalOpen(true)}
              />
            }
          >
            <ActionExpandedContent
              action="setup"
              lifecycleState={lifecycleState}
              isRunning={isRunning}
              runningAction={runningAction}
              actionStatus={actionStatus}
              actionProgress={actionProgress}
              actionResult={actionResult}
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
              onDismiss={handleDismiss}
              onDismissResult={onDismissResult}
              onSetup={onSetup}
              onCapture={onCapture}
              onShowDetails={() => setDetailsModalOpen(true)}
              setExpandedCard={setExpandedCard}
            />
          </ActionCard>
        </div>

        {/* Secondary Validation Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Validation</h3>
          {/* Check Card - SECONDARY */}
          <ActionCard
            action="check"
            expanded={expandedCard === 'check'}
            disabled={isCardDisabled('check')}
            title="Check computer"
            description={hasProfile 
              ? 'Verify your setup matches the profile'
              : 'Capture a profile first to get started'
            }
            icon={<CheckCircle className="h-5 w-5 text-amber-500" />}
            accentColor="amber"
            testId="overview-card-verify"
            cardRef={checkCardRef}
            expandedContentTestId="check-card-expanded-content"
            onToggle={() => handleCardClick('check')}
            collapsedStatusSlot={
              <ActionResultStrip
                action="check"
                actionStatus={actionStatus}
                actionProgress={actionProgress}
                actionResult={actionResult}
                runningAction={runningAction}
                isRunning={isRunning}
                onDismiss={handleDismiss}
                onShowDetails={() => setDetailsModalOpen(true)}
              />
            }
          >
            <ActionExpandedContent
              action="check"
              lifecycleState={lifecycleState}
              isRunning={isRunning}
              runningAction={runningAction}
              actionStatus={actionStatus}
              actionProgress={actionProgress}
              actionResult={actionResult}
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
              onDismiss={handleDismiss}
              onDismissResult={onDismissResult}
              onSetup={onSetup}
              onCapture={onCapture}
              onShowDetails={() => setDetailsModalOpen(true)}
              setExpandedCard={setExpandedCard}
            />
          </ActionCard>
        </div>
      </div>

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
        onOpenChange={setDetailsModalOpen}
        actionResult={actionResult}
        actionProgress={actionProgress}
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
