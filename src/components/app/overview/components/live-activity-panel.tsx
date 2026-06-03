/**
 * LiveActivityPanel - Collapsible live activity display during setup runs
 */

import { ChevronUp, ChevronDown, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFadeVariants } from '@/lib/motion';
import { 
  type AppEvent, 
  type StatusKey,
  getColorClasses,
  getPhaseAwareStatusForEvent,
  getPhaseColor,
} from '@/lib/apply-utils';
import { formatAppIdentity } from '@/lib/app-identity';
import { DisclosureButton } from '@/components/ui/disclosure-button';
import type { LiveCounters, ActionProgress } from '../types';

interface LiveActivityPanelProps {
  liveAppEvents: AppEvent[];
  liveCounters?: LiveCounters;
  actionProgress: ActionProgress;
  activityExpanded: boolean;
  setActivityExpanded: (expanded: boolean) => void;
  isAtBottom: boolean;
  setIsAtBottom: (atBottom: boolean) => void;
  setUserHasScrolledAway: (scrolledAway: boolean) => void;
  activityScrollRef: React.RefObject<HTMLDivElement>;
  liveActivityContainerRef: React.RefObject<HTMLDivElement>;
}

export function LiveActivityPanel({
  liveAppEvents,
  liveCounters,
  actionProgress,
  activityExpanded,
  setActivityExpanded,
  isAtBottom,
  setIsAtBottom,
  setUserHasScrolledAway,
  activityScrollRef,
  liveActivityContainerRef,
}: LiveActivityPanelProps) {
  const fadeVariants = getFadeVariants();
  const phaseColor = getPhaseColor(actionProgress.phase);
  const colorClasses = getColorClasses(phaseColor);
  const isVerifyPhase = actionProgress.phase === 'verify';

  if (liveAppEvents.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div 
        key="live-activity"
        ref={liveActivityContainerRef}
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className={`rounded-md border ${isVerifyPhase ? `${colorClasses.border} ${colorClasses.bg}` : 'border-border/50'}`}
      >
        <DisclosureButton
          className="text-xs"
          aria-expanded={activityExpanded}
          onClick={(e) => {
            e.stopPropagation();
            setActivityExpanded(!activityExpanded);
          }}
        >
          <span className="font-medium flex items-center gap-2">
            Live activity
            {/* Phase badge for visual distinction */}
            {isVerifyPhase && (
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${colorClasses.bg} ${colorClasses.text}`}>
                VERIFY
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {liveCounters && (
              <span className="flex items-center gap-1.5">
                {liveCounters.installed > 0 && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('success').bg} ${getColorClasses('success').text}`}>{liveCounters.installed} installed</span>}
                {liveCounters.alreadyPresent > 0 && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('success').bg} ${getColorClasses('success').text}`}>{liveCounters.alreadyPresent} present</span>}
                {liveCounters.skipped > 0 && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('warn').bg} ${getColorClasses('warn').text}`}>{liveCounters.skipped} skipped</span>}
                {liveCounters.failed > 0 && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('error').bg} ${getColorClasses('error').text}`}>{liveCounters.failed} failed</span>}
                {(liveCounters.configsRestored ?? 0) > 0 && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClasses('detected').bg} ${getColorClasses('detected').text}`}>{liveCounters.configsRestored} restored</span>}
              </span>
            )}
            {activityExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </div>
        </DisclosureButton>
        {activityExpanded && (
          <div className="relative border-t border-border/50">
            <div 
              ref={activityScrollRef}
              className="px-3 pb-3 space-y-1 max-h-64 overflow-y-auto scrollbar-thin"
              onScroll={(e) => {
                const target = e.currentTarget;
                let atLatest: boolean;
                if (actionProgress.phase === 'verify') {
                  // During verify, check if last verify event is visible (mid-list tracking)
                  const containerRect = target.getBoundingClientRect();
                  const verifyEvents = target.querySelectorAll('div[data-phase="verify"]');
                  if (verifyEvents.length > 0) {
                    const lastEvent = verifyEvents[verifyEvents.length - 1];
                    const eventRect = lastEvent.getBoundingClientRect();
                    atLatest = eventRect.bottom <= containerRect.bottom + 5;
                  } else {
                    atLatest = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 5;
                  }
                } else {
                  // Default: check absolute bottom
                  atLatest = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 5;
                }
                setIsAtBottom(atLatest);
                if (!atLatest) {
                  setUserHasScrolledAway(true);
                }
              }}
            >
              {liveAppEvents.map((event, idx) => {
                // Skip phase header events - the phase badge already signals the current phase
                if (event.app === '── APPLY ──' || event.app === '── VERIFY ──') {
                  return null;
                }
                
                // Use statusKey if available, otherwise derive from action
                const statusKey: StatusKey = event.statusKey || (
                  event.action === 'OK' ? 'present' :
                  event.action === 'Installed' ? 'installed' :
                  event.action === 'Failed' ? 'failed' :
                  event.action === 'Skipped' ? 'skipped' :
                  event.action === 'Cancelled' ? 'cancelled' :
                  event.action === 'Processing' ? 'installing' :
                  event.action === 'To install' ? 'to_install' :
                  'skipped'
                );
                // Use phase-aware status with reason for correct labels per phase
                const uiStatus = getPhaseAwareStatusForEvent({ statusKey, phase: event.phase, reason: event.reason });
                const colors = getColorClasses(uiStatus.color);
                
                return (
                  <div 
                    key={`${event.app}-${event.timestamp}-${idx}`} 
                    className="flex items-center gap-2 text-xs pt-1.5"
                    data-phase={event.phase}
                    data-event-index={idx}
                  >
                    <span className={`w-16 text-right font-medium ${colors.text}`}>
                      {uiStatus.shortLabel}
                    </span>
                    <span className="truncate flex-1">
                      {event.name || formatAppIdentity(event.app)}
                    </span>
                  </div>
                );
              })}
            </div>
            {!isAtBottom && (() => {
              // Use semantic phase color for subtle tinted pill
              const pillColor = getPhaseColor(actionProgress.phase);
              const pillClasses = getColorClasses(pillColor);
              
              return (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activityScrollRef.current) {
                      const container = activityScrollRef.current;
                      if (actionProgress.phase === 'verify') {
                        // During verify, scroll to last verified event (mid-list)
                        const verifyEvents = container.querySelectorAll('div[data-phase="verify"]');
                        if (verifyEvents.length > 0) {
                          const lastEvent = verifyEvents[verifyEvents.length - 1] as HTMLElement;
                          const eventRect = lastEvent.getBoundingClientRect();
                          const containerRect = container.getBoundingClientRect();
                          const targetTop = container.scrollTop + (eventRect.bottom - containerRect.bottom);
                          container.scrollTo({ top: targetTop, behavior: 'smooth' });
                        } else {
                          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                        }
                      } else {
                        // Default: scroll to absolute bottom
                        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                      }
                    }
                    setIsAtBottom(true);
                  }}
                  className={`absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 text-xs rounded-full shadow-lg transition-colors border ${pillClasses.bg} ${pillClasses.border} ${pillClasses.text}`}
                  aria-label="Jump to latest and re-enable auto-follow"
                  data-testid="latest-pill"
                >
                  <ArrowDown className="h-3 w-3" />
                  Latest
                </button>
              );
            })()}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
