/**
 * SetupFlow - Import + apply flow (ADR-001)
 *
 * Presents a drop zone for zip/manifest import alongside a list of existing
 * profiles. Selecting a profile triggers the preview/apply flow inline.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Download, FolderOpen, RefreshCw, Loader2, CheckCircle2, XCircle, Play, Eye } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropZone } from './drop-zone';
import { prefersReducedMotion, DURATIONS, EASING } from '@/lib/motion';
import type { DiscoveredProfile } from '@/file-discovery';
import {
  type AppEvent,
  type StatusKey,
  getColorClasses,
  getPhaseAwareStatusForEvent,
} from '@/lib/apply-utils';
import { formatAppIdentity } from '@/lib/app-identity';

type SetupPhase = 'browse' | 'previewing' | 'preview-done' | 'applying' | 'apply-done' | 'error';

interface PreviewResult {
  installed: number;
  alreadyPresent: number;
  appEvents: AppEvent[];
}

interface ApplyResult {
  installed: number;
  alreadyPresent: number;
  failed: number;
  skipped: number;
  appEvents: AppEvent[];
}

export interface SetupFlowProps {
  profiles: DiscoveredProfile[];
  onBack: () => void;
  onProfileSelect: (profile: DiscoveredProfile) => void;
  onOpenProfilesFolder: () => void;
  onRefreshProfiles: () => Promise<void>;
  onFileDrop: (files: File[]) => void;
  // Apply flow props
  isRunning: boolean;
  setupProgress: { message: string; detail?: string } | null;
  liveAppEvents: AppEvent[];
  onPreview: (profile: DiscoveredProfile) => Promise<PreviewResult>;
  onApply: (profile: DiscoveredProfile) => Promise<ApplyResult>;
}

export function SetupFlow({
  profiles,
  onBack,
  onProfileSelect,
  onOpenProfilesFolder,
  onRefreshProfiles,
  onFileDrop,
  isRunning,
  setupProgress,
  liveAppEvents,
  onPreview,
  onApply,
}: SetupFlowProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [phase, setPhase] = useState<SetupPhase>('browse');
  const [selectedProfile, setSelectedProfile] = useState<DiscoveredProfile | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const reduced = prefersReducedMotion();
  const transition = reduced
    ? { duration: 0.01 }
    : { duration: DURATIONS.normal, ease: EASING.easeInOut };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshProfiles();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectProfile = (profile: DiscoveredProfile) => {
    setSelectedProfile(profile);
    onProfileSelect(profile);
    // Auto-start preview when a profile is selected
    handlePreview(profile);
  };

  const handlePreview = async (profile: DiscoveredProfile) => {
    setPhase('previewing');
    setPreviewResult(null);
    setApplyResult(null);
    setErrorMessage('');
    try {
      const result = await onPreview(profile);
      setPreviewResult(result);
      setPhase('preview-done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Preview failed');
      setPhase('error');
    }
  };

  const handleApply = async () => {
    if (!selectedProfile) return;
    setPhase('applying');
    setApplyResult(null);
    setErrorMessage('');
    try {
      const result = await onApply(selectedProfile);
      setApplyResult(result);
      setPhase('apply-done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Apply failed');
      setPhase('error');
    }
  };

  const handleBackToProfiles = () => {
    setPhase('browse');
    setSelectedProfile(null);
    setPreviewResult(null);
    setApplyResult(null);
    setErrorMessage('');
  };

  // Tail of live events for activity display
  const recentEvents = liveAppEvents.slice(-8);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={transition}
      className="min-h-[calc(100vh-4rem)]"
      data-testid="setup-flow"
    >
      {/* Back navigation */}
      <button
        onClick={phase === 'browse' ? onBack : handleBackToProfiles}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        data-testid="setup-flow-back"
        disabled={phase === 'previewing' || phase === 'applying'}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {phase === 'browse' ? 'Back' : 'Back to profiles'}
      </button>

      {/* Flow header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-xl bg-green-500/10">
          <Download className="h-6 w-6 text-green-500" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Set up this computer</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {phase === 'browse'
              ? 'Import a saved setup or choose a profile to install your apps'
              : `Setting up from ${selectedProfile?.displayName || selectedProfile?.name || 'profile'}`}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Browse: Drop zone + Profile list */}
        {phase === 'browse' && (
          <motion.div
            key="browse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            {/* Drop zone for import */}
            <div className="mb-8">
              <DropZone onFileDrop={onFileDrop} disabled={isRunning} />
            </div>

            {/* Profile list */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium">
                  {profiles.length > 0
                    ? `${profiles.length} ${profiles.length === 1 ? 'profile' : 'profiles'} available`
                    : 'No profiles found'}
                </h3>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onOpenProfilesFolder}>
                    <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                    Open folder
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {profiles.length > 0 ? (
                <div className="grid gap-3">
                  {profiles.map((profile) => (
                    <Card
                      key={profile.name}
                      className="cursor-pointer hover:border-green-500/50 hover:shadow-md transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-green-500/50"
                      onClick={() => handleSelectProfile(profile)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectProfile(profile);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      data-testid={`profile-card-${profile.name}`}
                    >
                      <CardContent className="py-4 px-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">
                              {profile.displayName || profile.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {profile.name}
                            </p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            tabIndex={-1}
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-8 px-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Drop a zip bundle or manifest file above, or place profile files
                      in your Profiles folder.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        )}

        {/* Previewing: Progress display */}
        {phase === 'previewing' && (
          <motion.div
            key="previewing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-green-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="h-5 w-5 text-green-500 animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Previewing changes...</p>
                    {setupProgress && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {setupProgress.message}
                      </p>
                    )}
                    {setupProgress?.detail && (
                      <p className="text-xs text-muted-foreground">
                        {setupProgress.detail}
                      </p>
                    )}
                  </div>
                </div>

                {recentEvents.length > 0 && (
                  <div className="mt-3 space-y-1 border-t pt-3">
                    {recentEvents.map((event, i) => {
                      const statusKey: StatusKey = event.statusKey || (
                        event.action === 'OK' ? 'present' :
                        event.action === 'To install' ? 'to_install' :
                        event.action === 'Processing' ? 'installing' :
                        'skipped'
                      );
                      const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: 'preview', reason: event.reason });
                      const colors = getColorClasses(uiStatus.color);
                      return (
                        <div
                          key={`${event.app}-${event.timestamp}-${i}`}
                          className="flex items-center gap-2 text-xs pt-0.5"
                        >
                          <span className={`w-16 text-right font-medium ${colors.text}`}>
                            {uiStatus.shortLabel}
                          </span>
                          <span className="font-mono truncate flex-1">{formatAppIdentity(event.app)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Preview done: Show results + Apply button */}
        {phase === 'preview-done' && previewResult && (
          <motion.div
            key="preview-done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
            className="space-y-4"
          >
            <Card className="border-l-2 border-l-green-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Preview complete</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {previewResult.installed > 0
                        ? `${previewResult.installed} to install, ${previewResult.alreadyPresent} already present`
                        : `All ${previewResult.alreadyPresent} apps already present`}
                    </p>
                  </div>
                </div>

                {/* Activity summary */}
                {previewResult.appEvents.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      {previewResult.installed > 0 && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('action').bg} ${getColorClasses('action').text}`}>
                          {previewResult.installed} to install
                        </span>
                      )}
                      {previewResult.alreadyPresent > 0 && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('success').bg} ${getColorClasses('success').text}`}>
                          {previewResult.alreadyPresent} present
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {previewResult.appEvents.slice(0, 30).map((event, i) => {
                        const statusKey: StatusKey = event.statusKey || (
                          event.action === 'OK' ? 'present' :
                          event.action === 'To install' ? 'to_install' :
                          'skipped'
                        );
                        const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: 'preview', reason: event.reason });
                        const colors = getColorClasses(uiStatus.color);
                        return (
                          <div key={`${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5">
                            <span className={`w-16 text-right font-medium ${colors.text}`}>{uiStatus.shortLabel}</span>
                            <span className="font-mono truncate flex-1">{formatAppIdentity(event.app)}</span>
                          </div>
                        );
                      })}
                      {previewResult.appEvents.length > 30 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ...and {previewResult.appEvents.length - 30} more
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-6">
                  {previewResult.installed > 0 && (
                    <Button onClick={handleApply} data-testid="setup-flow-apply">
                      <Play className="h-4 w-4 mr-2" />
                      Apply changes
                    </Button>
                  )}
                  <Button variant="ghost" onClick={handleBackToProfiles}>
                    Back to profiles
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Applying: Progress display */}
        {phase === 'applying' && (
          <motion.div
            key="applying"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-green-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="h-5 w-5 text-green-500 animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Installing apps...</p>
                    {setupProgress && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {setupProgress.message}
                      </p>
                    )}
                    {setupProgress?.detail && (
                      <p className="text-xs text-muted-foreground">
                        {setupProgress.detail}
                      </p>
                    )}
                  </div>
                </div>

                {recentEvents.length > 0 && (
                  <div className="mt-3 space-y-1 border-t pt-3">
                    {recentEvents.map((event, i) => {
                      const statusKey: StatusKey = event.statusKey || (
                        event.action === 'OK' ? 'present' :
                        event.action === 'Installed' ? 'installed' :
                        event.action === 'Failed' ? 'failed' :
                        event.action === 'Processing' ? 'installing' :
                        event.action === 'Skipped' ? 'skipped' :
                        'installing'
                      );
                      const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: 'apply', reason: event.reason });
                      const colors = getColorClasses(uiStatus.color);
                      return (
                        <div
                          key={`${event.app}-${event.timestamp}-${i}`}
                          className="flex items-center gap-2 text-xs pt-0.5"
                        >
                          <span className={`w-16 text-right font-medium ${colors.text}`}>
                            {uiStatus.shortLabel}
                          </span>
                          <span className="font-mono truncate flex-1">{formatAppIdentity(event.app)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Apply done: Results */}
        {phase === 'apply-done' && applyResult && (
          <motion.div
            key="apply-done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className={`border-l-2 ${applyResult.failed > 0 ? 'border-l-amber-500/50' : 'border-l-green-500/50'}`}>
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  {applyResult.failed > 0 ? (
                    <XCircle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {applyResult.failed > 0 ? 'Setup completed with errors' : 'Setup complete'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {applyResult.installed} installed, {applyResult.alreadyPresent} already present
                      {applyResult.failed > 0 ? `, ${applyResult.failed} failed` : ''}
                    </p>
                  </div>
                </div>

                {/* Activity summary */}
                {applyResult.appEvents.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      {applyResult.installed > 0 && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('success').bg} ${getColorClasses('success').text}`}>
                          {applyResult.installed} installed
                        </span>
                      )}
                      {applyResult.alreadyPresent > 0 && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('success').bg} ${getColorClasses('success').text}`}>
                          {applyResult.alreadyPresent} present
                        </span>
                      )}
                      {applyResult.skipped > 0 && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('warn').bg} ${getColorClasses('warn').text}`}>
                          {applyResult.skipped} skipped
                        </span>
                      )}
                      {applyResult.failed > 0 && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('error').bg} ${getColorClasses('error').text}`}>
                          {applyResult.failed} failed
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {applyResult.appEvents.slice(0, 30).map((event, i) => {
                        const statusKey: StatusKey = event.statusKey || (
                          event.action === 'OK' ? 'present' :
                          event.action === 'Installed' ? 'installed' :
                          event.action === 'Failed' ? 'failed' :
                          event.action === 'Skipped' ? 'skipped' :
                          'installed'
                        );
                        const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: 'apply', reason: event.reason });
                        const colors = getColorClasses(uiStatus.color);
                        return (
                          <div key={`${event.app}-${i}`} className="flex items-center gap-2 text-xs pt-0.5">
                            <span className={`w-16 text-right font-medium ${colors.text}`}>{uiStatus.shortLabel}</span>
                            <span className="font-mono truncate flex-1">{formatAppIdentity(event.app)}</span>
                          </div>
                        );
                      })}
                      {applyResult.appEvents.length > 30 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ...and {applyResult.appEvents.length - 30} more
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <Button variant="ghost" className="mt-6" onClick={handleBackToProfiles}>
                  Back to profiles
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-red-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">Something went wrong</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {errorMessage}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" onClick={handleBackToProfiles} className="mt-2">
                  Back to profiles
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
