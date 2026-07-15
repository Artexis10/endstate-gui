import { TicketCheck } from 'lucide-react';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import { Button } from '@/components/ui/button';

interface HostedBackupSignedOutProps {
  onSignIn: () => void;
  onCreateAccount: () => void;
  onUsePurchaseCode: () => void;
}

export function HostedBackupSignedOut({
  onSignIn,
  onCreateAccount,
  onUsePurchaseCode,
}: HostedBackupSignedOutProps) {
  return (
    <div className="m-6 max-w-xl" data-testid="backup-pane-signed-out">
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Hosted Backup</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Save your machine setup to encrypted cloud storage. Restore it on any machine.
        </p>
        <p className="mt-4 text-sm">
          <span className="font-medium">€4/month</span>
          <span className="text-muted-foreground"> — billed monthly, cancel anytime.</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <Button
            type="button"
            variant="link"
            size="inline"
            onClick={() => void openExternal('https://substratesystems.io/endstate')}
          >
            Learn more → substratesystems.io/endstate
          </Button>
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="primary" onClick={onSignIn}>
            Sign in
          </Button>
          <Button type="button" variant="secondary" onClick={onCreateAccount}>
            Create account
          </Button>
          <Button type="button" variant="secondary" onClick={onUsePurchaseCode}>
            <TicketCheck className="mr-2 h-4 w-4" aria-hidden="true" />
            Use purchase code
          </Button>
        </div>
      </div>
    </div>
  );
}
