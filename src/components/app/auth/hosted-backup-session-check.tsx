import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HostedBackupSessionCheckProps {
  providerKind?: 'endstate-cloud' | 'self-hosted' | 'unknown';
  failed: boolean;
  busy: boolean;
  onRetry: () => void;
}

export function HostedBackupSessionCheck({
  providerKind = 'endstate-cloud',
  failed,
  busy,
  onRetry,
}: HostedBackupSessionCheckProps) {
  const serviceName = providerKind === 'self-hosted' ? 'self-hosted backup service' : providerKind === 'endstate-cloud' ? 'Endstate Cloud' : 'backup service';
  if (!failed) {
    return (
      <div className="m-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>Checking your {serviceName} session…</span>
      </div>
    );
  }

  return (
    <div className="m-6 max-w-xl" role="alert">
      <div className="flex items-start gap-2 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <p className="font-medium">Could not check your {serviceName} session.</p>
          <p className="mt-1 text-muted-foreground">
            {providerKind === 'endstate-cloud'
              ? 'Retry before signing in, creating an account, or using a purchase code.'
              : 'Retry before signing in.'}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3"
        disabled={busy}
        onClick={onRetry}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        )}
        {busy ? 'Checking session' : 'Retry session check'}
      </Button>
    </div>
  );
}
