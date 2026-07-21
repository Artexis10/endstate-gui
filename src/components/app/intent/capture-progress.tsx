import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CaptureStage } from '@/lib/streaming-events';

const STAGE_COPY: Record<CaptureStage, string> = {
  inventory: 'Checking installed apps…',
  settings: 'Collecting app settings…',
  packaging: 'Packaging your setup…',
};

const SLOW_CAPTURE_REASSURANCE =
  'Still working — your package manager can take 20 seconds or more on systems with many apps.';

export interface CaptureProgressProps {
  stage: CaptureStage | null;
}

export function CaptureProgress({ stage }: CaptureProgressProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = globalThis.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1_000);
    return () => globalThis.clearInterval(interval);
  }, []);

  const stageCopy = stage ? STAGE_COPY[stage] : 'Starting capture…';

  return (
    <div className="flex items-start gap-3">
      <div
        role="progressbar"
        aria-label="Capture in progress"
        aria-valuetext={stageCopy}
        className="mt-0.5"
      >
        <Loader2 className="h-5 w-5 text-blue-500 animate-spin" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium" aria-live="polite">
          {stageCopy}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Elapsed {elapsedSeconds}s</p>
        {elapsedSeconds >= 8 && (
          <p className="text-xs text-muted-foreground mt-2">{SLOW_CAPTURE_REASSURANCE}</p>
        )}
      </div>
    </div>
  );
}
