/**
 * IntentLanding - Full-viewport binary intent selector (ADR-001)
 *
 * The app's entry point. Two large interactive regions:
 *   - "Save this computer" → Capture flow
 *   - "Set up this computer" → Import + apply flow
 *
 * No sidebar, no navigation chrome. Full immersive viewport.
 */

import { motion } from 'framer-motion';
import markUrl from '../../../../assets/brand/mark-sidebar.svg?url';
import { HardDrive, Download } from 'lucide-react';
import { prefersReducedMotion, DURATIONS, EASING } from '@/lib/motion';
import { pluralize } from '@/lib/pluralize';

interface IntentLandingProps {
  onSelectSave: () => void;
  onSelectSetup: () => void;
  engineConnected?: boolean;
  saveHasSession?: boolean;
  setupHasSession?: boolean;
  /**
   * Drifted-app count from the last scheduled drift check (engine `schedule
   * status`). When > 0 the amber drift chip takes precedence over the
   * "Scan complete" session chip. Absent/0 → no drift chip.
   */
  driftCount?: number;
  /** ISO timestamp of the last scheduled drift check (tooltip only). */
  driftCheckedAt?: string;
  /** True when the last scheduled drift check failed to complete. */
  driftCheckFailing?: boolean;
}

export function IntentLanding({
  onSelectSave,
  onSelectSetup,
  engineConnected = true,
  saveHasSession,
  setupHasSession,
  driftCount,
  driftCheckedAt,
  driftCheckFailing,
}: IntentLandingProps) {
  const reduced = prefersReducedMotion();
  const disabled = !engineConnected;

  const transition = reduced
    ? { duration: 0.01 }
    : { duration: DURATIONS.normal, ease: EASING.easeInOut };

  const childDelay = reduced ? 0 : 0.1;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: 0 }}
        className="text-center mb-12"
      >
        <div className="flex justify-center mb-4">
          <img src={markUrl} className="h-14 w-14" alt="" aria-hidden="true" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">Endstate</h1>
        <p className="text-base text-muted-foreground">
          What would you like to do?
        </p>
      </motion.div>

      {/* Intent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
        {/* Save this computer */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition, delay: childDelay }}
          onClick={onSelectSave}
          disabled={disabled}
          className={`group relative flex flex-col items-center text-center gap-6 p-10 rounded-2xl border-2 transition-all duration-200 outline-none ${
            disabled
              ? 'opacity-50 cursor-not-allowed border-border'
              : 'border-blue-500/30 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500/50 cursor-pointer'
          }`}
          data-testid="intent-save"
        >
          <div className={`p-5 rounded-2xl transition-colors duration-200 ${
            disabled ? 'bg-muted' : 'bg-blue-500/10 group-hover:bg-blue-500/20'
          }`}>
            <HardDrive className={`h-10 w-10 ${disabled ? 'text-muted-foreground' : 'text-blue-500'}`} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Save this computer</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
              Scan your apps and settings, then save everything as a portable file
            </p>
          </div>
          {/* Chip slot — one chip at a time. Drift (engine-reported, amber)
              takes precedence over a failing drift check (muted), which takes
              precedence over the transient "Scan complete" session chip.
              Clean / never-run scheduled states render nothing. */}
          {driftCount != null && driftCount > 0 ? (
            <motion.div
              className="absolute top-3 right-3"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.2 }}
              data-testid="drift-chip"
            >
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-500"
                title={driftCheckedAt ? `Last checked ${driftCheckedAt}` : undefined}
              >
                {driftCount} {pluralize(driftCount, 'app')} drifted since your snapshot
              </span>
            </motion.div>
          ) : driftCheckFailing ? (
            <motion.div
              className="absolute top-3 right-3"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.2 }}
              data-testid="drift-check-failing-chip"
            >
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground"
                title={driftCheckedAt ? `Last checked ${driftCheckedAt}` : undefined}
              >
                Drift check failing
              </span>
            </motion.div>
          ) : saveHasSession ? (
            <motion.div
              className="absolute top-3 right-3"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.2 }}
            >
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-500">
                Scan complete
              </span>
            </motion.div>
          ) : null}
        </motion.button>

        {/* Set up this computer */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition, delay: childDelay * 2 }}
          onClick={onSelectSetup}
          disabled={disabled}
          className={`group relative flex flex-col items-center text-center gap-6 p-10 rounded-2xl border-2 transition-all duration-200 outline-none ${
            disabled
              ? 'opacity-50 cursor-not-allowed border-border'
              : 'border-green-500/30 hover:border-green-500 hover:shadow-xl hover:shadow-green-500/10 hover:-translate-y-1 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-green-500/50 cursor-pointer'
          }`}
          data-testid="intent-setup"
        >
          <div className={`p-5 rounded-2xl transition-colors duration-200 ${
            disabled ? 'bg-muted' : 'bg-green-500/10 group-hover:bg-green-500/20'
          }`}>
            <Download className={`h-10 w-10 ${disabled ? 'text-muted-foreground' : 'text-green-500'}`} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Set up this computer</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
              Import a saved setup or choose an existing profile to install your apps
            </p>
          </div>
          {setupHasSession && (
            <motion.div
              className="absolute top-3 right-3"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.2 }}
            >
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/15 text-green-500">
                Results ready
              </span>
            </motion.div>
          )}
        </motion.button>
      </div>
    </div>
  );
}
