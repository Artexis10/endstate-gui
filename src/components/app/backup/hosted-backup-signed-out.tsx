import { TicketCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HostedBackupSignedOutProps {
  providerKind?: 'endstate-cloud' | 'self-hosted' | 'unknown';
  onSignIn: () => void;
  onCreateAccount: () => void;
  onUsePurchaseCode: () => void;
}

export function HostedBackupSignedOut({
  providerKind = 'endstate-cloud',
  onSignIn,
  onCreateAccount,
  onUsePurchaseCode,
}: HostedBackupSignedOutProps) {
  const selfHosted = providerKind === 'self-hosted';
  const managedService = providerKind === 'endstate-cloud';
  return (
    <div className="m-6 max-w-xl" data-testid="backup-pane-signed-out">
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">{selfHosted ? 'Self-hosted backup' : managedService ? 'Endstate Cloud' : 'Backup service'}</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {selfHosted
            ? 'Use the configured self-hosted service for your Endstate application list and supported non-secret settings.'
            : managedService
              ? 'Endstate Cloud keeps your Endstate application list and supported non-secret settings in encrypted cloud storage, ready to restore on another Windows PC.'
              : 'Sign in to use the configured backup service for your Endstate application list and supported non-secret settings.'}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="primary" onClick={onSignIn}>
            Sign in
          </Button>
          {managedService && (
            <>
              <Button type="button" variant="secondary" onClick={onCreateAccount}>
                Create account
              </Button>
              <Button type="button" variant="secondary" onClick={onUsePurchaseCode}>
                <TicketCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                Use purchase code
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
