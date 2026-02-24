/**
 * SaveFlow - Placeholder for the Save (capture) flow (ADR-001)
 *
 * Stateless guided capture: scan → curate → produce zip → save dialog.
 * No in-GUI capture history. Session-scoped result display only.
 *
 * This is the structural shell. Full implementation is a separate change.
 */

import { motion } from 'framer-motion';
import { ArrowLeft, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { prefersReducedMotion, DURATIONS, EASING } from '@/lib/motion';

interface SaveFlowProps {
  onBack: () => void;
}

export function SaveFlow({ onBack }: SaveFlowProps) {
  const reduced = prefersReducedMotion();
  const transition = reduced
    ? { duration: 0.01 }
    : { duration: DURATIONS.normal, ease: EASING.easeInOut };

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

      {/* Placeholder content */}
      <Card className="border-l-2 border-l-blue-500/50">
        <CardContent className="py-12 px-6 text-center">
          <p className="text-muted-foreground">
            Capture flow will be implemented here.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Scan machine, curate selection, produce zip bundle.
          </p>
          <Button
            variant="secondary"
            className="mt-6"
            disabled
          >
            Start scan
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
