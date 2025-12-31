import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import type { FeedbackState } from '@/lib/micro-feedback';

interface InlineFeedbackPopoverProps {
  feedback: FeedbackState;
}

const iconMap = {
  success: CheckCircle2,
  warn: AlertTriangle,
  error: AlertCircle,
};

const colorMap = {
  success: 'text-green-600 dark:text-green-400',
  warn: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400',
};

export function InlineFeedbackPopover({ feedback }: InlineFeedbackPopoverProps) {
  if (!feedback.visible) return null;

  const Icon = iconMap[feedback.intent];
  const colorClass = colorMap[feedback.intent];
  const ariaLive = feedback.intent === 'error' ? 'assertive' : 'polite';

  return (
    <div
      className="absolute -top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      role="status"
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <div className="bg-popover text-popover-foreground px-2 py-1 rounded shadow-md text-xs whitespace-nowrap flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${colorClass}`} />
        <span>{feedback.message}</span>
      </div>
    </div>
  );
}
