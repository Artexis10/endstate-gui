/**
 * SaveFlow - Stateless guided capture flow (ADR-001)
 *
 * Scan → curate → produce output → save dialog.
 * No in-GUI capture history. Session-scoped result display only.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, HardDrive, Loader2, CheckCircle2, XCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { prefersReducedMotion, DURATIONS, EASING } from '@/lib/motion';
import {
  type AppEvent,
  type StatusKey,
  getColorClasses,
  getPhaseAwareStatusForEvent,
} from '@/lib/apply-utils';
import { formatAppIdentity } from '@/lib/app-identity';

type CapturePhase = 'idle' | 'scanning' | 'done' | 'error' | 'saving';

interface CaptureResult {
  count: number;
  draftText: string;
  apps: string[];
  /** Engine output path (zip or jsonc) - used for file copy on save */
  outputPath?: string;
  /** Engine output format: 'zip' or 'jsonc' */
  outputFormat?: 'zip' | 'jsonc';
}

export interface SaveFlowProps {
  onBack: () => void;
  engineConnected: boolean;
  isRunning: boolean;
  captureProgress: { message: string; detail?: string } | null;
  liveAppEvents: AppEvent[];
  onStartCapture: () => Promise<CaptureResult>;
  onSaveToFile: (result: CaptureResult) => Promise<boolean>;
}

export function SaveFlow({
  onBack,
  engineConnected,
  isRunning,
  captureProgress,
  liveAppEvents,
  onStartCapture,
  onSaveToFile,
}: SaveFlowProps) {
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const reduced = prefersReducedMotion();
  const transition = reduced
    ? { duration: 0.01 }
    : { duration: DURATIONS.normal, ease: EASING.easeInOut };

  const handleStartScan = async () => {
    setPhase('scanning');
    setResult(null);
    setErrorMessage('');
    try {
      const captureResult = await onStartCapture();
      setResult(captureResult);
      setPhase('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Capture failed');
      setPhase('error');
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setPhase('saving');
    try {
      const saved = await onSaveToFile(result);
      if (saved) {
        // Reset for another capture
        setPhase('idle');
        setResult(null);
      } else {
        // User cancelled save dialog
        setPhase('done');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Save failed');
      setPhase('error');
    }
  };

  const handleScanAgain = () => {
    setPhase('idle');
    setResult(null);
    setErrorMessage('');
  };

  // Tail of live events for activity display
  const recentEvents = liveAppEvents.slice(-8);

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={transition}
      className="min-h-[calc(100vh-4rem)]"
      data-testid="save-flow"
    >
      {/* Back navigation */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        data-testid="save-flow-back"
        disabled={phase === 'scanning'}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      {/* Flow header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 rounded-xl bg-blue-500/10">
          <HardDrive className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Save this computer</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scan your apps and settings, then save everything as a portable file
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* Idle: Start scan */}
        {phase === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
          >
            <Card className="border-l-2 border-l-blue-500/50">
              <CardContent className="py-12 px-6 text-center">
                <p className="text-muted-foreground">
                  Scan this computer to find installed apps and settings.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  You'll be able to save the result as a portable file.
                </p>
                <Button
                  className="mt-6"
                  onClick={handleStartScan}
                  disabled={!engineConnected || isRunning}
                  data-testid="save-flow-start-scan"
                >
                  Start scan
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Scanning: Progress display */}
        {phase === 'scanning' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
            className="space-y-4"
          >
            <Card className="border-l-2 border-l-blue-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Scanning...</p>
                    {captureProgress && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {captureProgress.message}
                      </p>
                    )}
                    {captureProgress?.detail && (
                      <p className="text-xs text-muted-foreground">
                        {captureProgress.detail}
                      </p>
                    )}
                  </div>
                </div>

                {/* Live activity tail */}
                {recentEvents.length > 0 && (
                  <div className="mt-3 space-y-1 border-t pt-3">
                    {recentEvents.map((event, i) => {
                      const statusKey: StatusKey = event.statusKey || 'detected';
                      const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: 'capture', reason: event.reason });
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

        {/* Done: Result summary + Save */}
        {(phase === 'done' || phase === 'saving') && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={transition}
            className="space-y-4"
          >
            <Card className="border-l-2 border-l-green-500/50">
              <CardContent className="py-6 px-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Scan complete</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Found {result.count} {result.count === 1 ? 'app' : 'apps'}
                    </p>
                  </div>
                </div>

                {/* App list preview */}
                {result.apps.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('detected').bg} ${getColorClasses('detected').text}`}>
                        {result.apps.length} detected
                      </span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {result.apps.slice(0, 30).map((app) => {
                        const colors = getColorClasses('detected');
                        return (
                          <div key={app} className="flex items-center gap-2 text-xs pt-0.5">
                            <span className={`w-16 text-right font-medium ${colors.text}`}>DETECTED</span>
                            <span className="font-mono truncate flex-1">{formatAppIdentity(app)}</span>
                          </div>
                        );
                      })}
                      {result.apps.length > 30 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ...and {result.apps.length - 30} more
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-6">
                  <Button
                    onClick={handleSave}
                    disabled={phase === 'saving'}
                    data-testid="save-flow-save-file"
                  >
                    {phase === 'saving' ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save file
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleScanAgain}
                    disabled={phase === 'saving'}
                  >
                    Scan again
                  </Button>
                </div>
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
                    <p className="text-sm font-medium">Scan failed</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {errorMessage}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleScanAgain}
                  className="mt-2"
                >
                  Try again
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
