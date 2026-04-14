import { useEffect, useState, type ReactNode } from 'react';
import { checkLicense, activateLicense, type LicenseStatus } from '@/lib/license';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ExternalLink, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LicenseGateProps {
  children: ReactNode;
}

export function LicenseGate({ children }: LicenseGateProps) {
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_LICENSE === '1') {
    return <>{children}</>;
  }

  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [keyInput, setKeyInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    checkLicense()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ activated: false, key: null, instanceId: null, activatedAt: null, machineName: null, validationError: null });
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleActivate = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setActivating(true);
    setError(null);
    try {
      const result = await activateLicense(trimmed);
      if (result.activated) {
        setStatus(result);
      } else {
        setError(result.validationError || 'Activation failed. Please check your license key.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setActivating(false);
    }
  };

  // Callback for deactivation from settings — resets gate to activation screen
  if (status?.activated) {
    return <LicenseGateContext.Provider value={{ status, onDeactivated: () => {
      setStatus({ activated: false, key: null, instanceId: null, activatedAt: null, machineName: null, validationError: null });
      setKeyInput('');
      setError(null);
    }}}>{children}</LicenseGateContext.Provider>;
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Activate Endstate</CardTitle>
          <CardDescription>
            Enter your license key to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !activating) handleActivate();
              }}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              disabled={activating}
              autoFocus
              aria-label="License key"
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
          </div>
          <Button
            className="w-full"
            onClick={handleActivate}
            disabled={activating || !keyInput.trim()}
          >
            {activating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : (
              'Activate'
            )}
          </Button>
          <div className="text-center">
            <a
              href="https://substratesystems.io/endstate"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-1 text-sm text-muted-foreground',
                'hover:text-foreground transition-colors'
              )}
            >
              Buy Endstate
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Context for license status + deactivation callback (used by Settings)
import { createContext, useContext } from 'react';

interface LicenseGateContextValue {
  status: LicenseStatus;
  onDeactivated: () => void;
}

const LicenseGateContext = createContext<LicenseGateContextValue | null>(null);

export function useLicenseGate(): LicenseGateContextValue | null {
  return useContext(LicenseGateContext);
}
