import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Loader2, Circle } from 'lucide-react';

export type StatusType = 'ok' | 'missing' | 'mismatch' | 'running' | 'error' | 'neutral';

interface StatusPillProps {
  status: StatusType;
  label?: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  const config = {
    ok: {
      variant: 'success' as const,
      icon: CheckCircle2,
      text: label || 'OK',
    },
    missing: {
      variant: 'warning' as const,
      icon: AlertCircle,
      text: label || 'Missing',
    },
    mismatch: {
      variant: 'warning' as const,
      icon: AlertCircle,
      text: label || 'Mismatch',
    },
    running: {
      variant: 'default' as const,
      icon: Loader2,
      text: label || 'Running',
    },
    error: {
      variant: 'danger' as const,
      icon: XCircle,
      text: label || 'Error',
    },
    neutral: {
      variant: 'secondary' as const,
      icon: Circle,
      text: label || 'Unknown',
    },
  };

  const { variant, icon: Icon, text } = config[status];

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {text}
    </Badge>
  );
}
