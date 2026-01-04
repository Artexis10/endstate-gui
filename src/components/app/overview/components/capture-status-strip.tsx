/**
 * CaptureStatusStrip - Status strip for capture card (draft/saved states)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { FileText, CheckCircle2 } from 'lucide-react';
import { getFadeSlideVariants } from '@/lib/motion';
import { Button } from '@/components/ui/button';

interface CaptureStatusStripProps {
  variant: 'collapsed' | 'expanded';
  pendingCaptureDraft?: {
    capturedAppsCount: number;
    capturedAt: string;
    outputPath: string;
    apps: string[];
  } | null;
  lastSavedProfileSummary?: {
    appCount: number;
    finishedAt: string;
    profileName?: string;
  } | null;
  appCount?: number; // From actionResult.counts.total
  onSaveProfile?: () => void;
  onDiscardDraft?: () => void;
  onDismiss: () => void;
  onShowDetails: () => void;
}

export function CaptureStatusStrip({
  variant,
  pendingCaptureDraft,
  lastSavedProfileSummary,
  appCount,
  onSaveProfile,
  onDiscardDraft,
  onDismiss,
  onShowDetails,
}: CaptureStatusStripProps) {
  const fadeSlideVariants = getFadeSlideVariants('up');
  const hasDraft = !!pendingCaptureDraft;
  const hasSuccess = !pendingCaptureDraft && !!lastSavedProfileSummary;

  if (!hasDraft && !hasSuccess) return null;

  if (variant === 'expanded') {
    return (
      <div className="px-6 pt-4">
        <AnimatePresence mode="wait">
          {hasDraft && (
            <motion.div
              key="draft-status"
              variants={fadeSlideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="flex items-center gap-3 bg-warning/10 rounded-md px-3 py-3 border border-warning/20" data-testid="capture-draft-card">
                <FileText className="h-4 w-4 text-warning" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-warning">
                    Capture finished
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Not saved yet — save to create a profile
                  </p>
                </div>
                {onDiscardDraft && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDiscardDraft();
                    }}
                    data-testid="discard-draft-button"
                  >
                    Discard draft
                  </Button>
                )}
                {onSaveProfile && (
                  <Button
                    size="sm"
                    className="bg-warning hover:bg-warning/90 text-warning-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSaveProfile();
                    }}
                    data-testid="save-profile-button"
                  >
                    Save profile
                  </Button>
                )}
              </div>
            </motion.div>
          )}
          {hasSuccess && lastSavedProfileSummary && (
            <motion.div
              key="capture-success"
              variants={fadeSlideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="flex items-center gap-3 bg-success/10 rounded-md px-3 py-3 border border-success/20" data-testid="capture-success-card">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-success">
                    Completed successfully
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {lastSavedProfileSummary.appCount === 0 
                      ? 'No apps detected' 
                      : `${lastSavedProfileSummary.appCount} apps captured`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                  data-testid="expanded-success-dismiss"
                >
                  Dismiss
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowDetails();
                  }}
                >
                  Details
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Collapsed variant
  if (hasDraft) {
    const detailText = appCount ? `${appCount} apps captured — not saved yet` : 'Not saved yet';
    return (
      <div className="pt-8">
        <div 
          className="flex items-center gap-3 px-3 py-2.5 rounded-md border text-sm bg-warning/10 text-warning border-warning/20"
          data-testid="card-status-strip-capture"
        >
          <FileText className="h-4 w-4 flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-medium whitespace-nowrap">Capture finished</span>
            <span className="text-muted-foreground flex-shrink-0">—</span>
            <span className="text-muted-foreground truncate">{detailText}</span>
          </div>
          {onDiscardDraft && (
            <Button
              variant="ghost"
              size="sm"
              className="text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onDiscardDraft();
              }}
              data-testid="collapsed-discard-draft"
            >
              Discard draft
            </Button>
          )}
          {onSaveProfile && (
            <Button
              size="sm"
              className="bg-warning hover:bg-warning/90 text-warning-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onSaveProfile();
              }}
              data-testid="collapsed-save-profile"
            >
              Save profile
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (hasSuccess && lastSavedProfileSummary) {
    const detailText = lastSavedProfileSummary.appCount === 0 
      ? 'No apps detected' 
      : `${lastSavedProfileSummary.appCount} apps captured`;
    return (
      <div className="pt-8">
        <div 
          className="flex items-center gap-3 px-3 py-2.5 rounded-md border text-sm bg-success/10 text-success border-success/20"
          data-testid="card-status-strip-capture"
        >
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-medium whitespace-nowrap">Completed successfully</span>
            <span className="text-muted-foreground flex-shrink-0">—</span>
            <span className="text-muted-foreground truncate">{detailText}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            data-testid="card-status-dismiss"
          >
            Dismiss
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onShowDetails();
            }}
          >
            Details
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
