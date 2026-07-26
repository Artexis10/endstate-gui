/**
 * "What's inside" — what a capture bundle actually contains, without an archiver.
 *
 * This answers "what am I about to apply?", not "what files are in this zip":
 * when it was captured, how many apps and which ones, and which settings come
 * with them. Everything shown is read from the manifest already extracted on
 * disk; nothing is inferred.
 *
 * Module ids, capture ids and the file path stay behind "Configuration details"
 * per openspec/specs/config-generation-presentation/spec.md and the jargon
 * guardrail in docs/ux-guardrails.md.
 */

import { useEffect, useState } from 'react';
import { Loader2, Package, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DetailsDisclosure } from '@/components/ui/details-disclosure';
import { loadProfileContents, type ProfileContents } from '@/lib/profile-contents';

interface ProfileContentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absolute path to the profile's manifest. */
  profilePath: string;
  /** The name the profile card shows. */
  profileDisplayName: string;
}

function formatCaptured(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ProfileContentsModal({
  open,
  onOpenChange,
  profilePath,
  profileDisplayName,
}: ProfileContentsModalProps) {
  const [contents, setContents] = useState<ProfileContents | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profilePath) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setContents(null);

    loadProfileContents(profilePath)
      .then((result) => {
        if (cancelled) return;
        setContents(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, profilePath]);

  const appCount = contents?.apps.length ?? 0;
  const settingsCount = contents?.settingsModuleCount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pr-8">
          <DialogTitle>What&apos;s inside</DialogTitle>
          <DialogDescription>
            {profileDisplayName || 'This profile'}
            {contents?.captured
              ? ` · captured ${formatCaptured(contents.captured)}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reading this profile…
          </p>
        )}

        {error && (
          <div
            className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2"
            role="alert"
          >
            <p className="text-sm text-foreground">This profile could not be read.</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {contents && !loading && !error && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{pluralize(appCount, 'app', 'apps')}</Badge>
              {settingsCount > 0 && (
                <Badge variant="secondary">
                  {pluralize(settingsCount, 'setting', 'settings')}
                </Badge>
              )}
              {!contents.captured && (
                <span className="text-xs text-muted-foreground">
                  No capture date recorded
                </span>
              )}
            </div>

            <section className="space-y-2" aria-labelledby="profile-contents-apps">
              <h3
                id="profile-contents-apps"
                className="flex items-center gap-1.5 text-sm font-medium"
              >
                <Package className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Apps
              </h3>
              {appCount === 0 ? (
                <p className="text-xs text-muted-foreground">
                  This profile carries settings only — it installs no apps.
                </p>
              ) : (
                <ul className="space-y-1">
                  {contents.apps.map((label, index) => (
                    <li key={`${label}-${index}`} className="truncate text-sm" title={label}>
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2" aria-labelledby="profile-contents-settings">
              <h3
                id="profile-contents-settings"
                className="flex items-center gap-1.5 text-sm font-medium"
              >
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                Settings
              </h3>
              {settingsCount === 0 ? (
                <p className="text-xs text-muted-foreground">
                  This profile installs apps only — no settings are included.
                </p>
              ) : (
                <>
                  <ul className="space-y-1">
                    {contents.settings.map((module, index) => (
                      <li
                        key={`${module.label}-${index}`}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="truncate" title={module.label}>
                          {module.label}
                        </span>
                        {module.entryCount > 0 && (
                          <span className="flex-shrink-0 text-xs text-muted-foreground">
                            {pluralize(module.entryCount, 'file', 'files')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {/* A module whose name could not be resolved is counted, never
                      named — its id belongs in Configuration details. State the
                      fact without guessing at a cause. */}
                  {contents.settings.length < settingsCount && (
                    <p className="text-xs text-muted-foreground">
                      {settingsCount - contents.settings.length === 1
                        ? '1 more setting has no name in this profile.'
                        : `${settingsCount - contents.settings.length} more settings have no name in this profile.`}
                    </p>
                  )}
                </>
              )}
            </section>

            <DetailsDisclosure title="Configuration details" className="border-t pt-3">
              <dl className="space-y-1 text-xs text-muted-foreground">
                {contents.profileName && (
                  <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                    <dt>Manifest name</dt>
                    <dd className="break-all font-mono">{contents.profileName}</dd>
                  </div>
                )}
                {contents.manifestVersion !== null && (
                  <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                    <dt>Manifest version</dt>
                    <dd className="break-all font-mono">{contents.manifestVersion}</dd>
                  </div>
                )}
                {contents.captured && (
                  <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                    <dt>Captured</dt>
                    <dd className="break-all font-mono">{contents.captured}</dd>
                  </div>
                )}
                {contents.moduleIds.length > 0 && (
                  <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                    <dt>Module IDs</dt>
                    <dd className="break-all font-mono">{contents.moduleIds.join(', ')}</dd>
                  </div>
                )}
                <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                  <dt>Path</dt>
                  <dd className="break-all font-mono">{profilePath}</dd>
                </div>
              </dl>
            </DetailsDisclosure>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 pt-2">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
