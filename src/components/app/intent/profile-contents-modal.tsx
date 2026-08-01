/** Read-only profile inventory, authored by the engine's `profile inspect` command. */

import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailsDisclosure } from "@/components/ui/details-disclosure";
import { Input } from "@/components/ui/input";
import type {
  ProfileInspectionData,
  ProfileInspectionSettingsApp,
} from "@/types";

type ProfileContentsTab = "apps" | "settings";

interface ProfileContentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absolute path to the profile's manifest. */
  profilePath: string;
  /** The name the profile card shows. */
  profileDisplayName: string;
  /** Advertised by the current capabilities envelope. */
  profileInspectionSupported?: boolean;
  /** One-shot read-only engine inspection supplied by App. */
  onInspectProfile?: (manifestPath: string) => Promise<ProfileInspectionData>;
}
function formatCaptured(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function defaultTab(contents: ProfileInspectionData): ProfileContentsTab {
  return contents.apps.length === 0 && contents.settingsApps.length > 0
    ? "settings"
    : "apps";
}

function rowMatches(query: string, values: string[]): boolean {
  const needle = query.trim().toLowerCase();
  return (
    !needle ||
    values.some((value) => value.toLowerCase().includes(needle))
  );
}

function settingsAssociationCopy(
  row: ProfileInspectionSettingsApp,
): string | null {
  if (row.associationStatus === "not_in_profile") return "App not included";
  if (
    row.associationStatus === "ambiguous" ||
    row.associationStatus === "unresolved"
  ) {
    return "Association could not be identified.";
  }
  return null;
}

export function ProfileContentsModal({
  open,
  onOpenChange,
  profilePath,
  profileDisplayName,
  profileInspectionSupported = false,
  onInspectProfile,
}: ProfileContentsModalProps) {
  const [contents, setContents] = useState<{
    profilePath: string;
    data: ProfileInspectionData;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ profilePath: string; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileContentsTab>("apps");
  const [appsQuery, setAppsQuery] = useState("");
  const [settingsQuery, setSettingsQuery] = useState("");
  const requestId = useRef(0);
  const inspectRef = useRef(onInspectProfile);
  const tabId = useId();

  useEffect(() => {
    inspectRef.current = onInspectProfile;
  }, [onInspectProfile]);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    setAppsQuery("");
    setSettingsQuery("");
    setContents(null);
    setError(null);
    setActiveTab("apps");

    if (!open || !profilePath) {
      setLoading(false);
      return;
    }

    if (!profileInspectionSupported || !inspectRef.current) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void inspectRef
      .current(profilePath)
      .then((result) => {
        if (requestId.current !== currentRequest) return;
        setContents({ profilePath, data: result });
        setActiveTab(defaultTab(result));
      })
      .catch((err: unknown) => {
        if (requestId.current !== currentRequest) return;
        setError({
          profilePath,
          message: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        if (requestId.current === currentRequest) setLoading(false);
      });
  }, [open, profilePath, profileInspectionSupported]);

  const chooseTab = (tab: ProfileContentsTab, focus = false) => {
    setActiveTab(tab);
    if (focus) {
      document.getElementById(`${tabId}-${tab}-tab`)?.focus();
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    let nextTab: ProfileContentsTab | null = null;
    if (event.key === "Home") nextTab = "apps";
    if (event.key === "End") nextTab = "settings";
    if (event.key === "ArrowLeft") nextTab = activeTab === "apps" ? "settings" : "apps";
    if (event.key === "ArrowRight") nextTab = activeTab === "apps" ? "settings" : "apps";
    if (!nextTab) return;
    event.preventDefault();
    chooseTab(nextTab, true);
  };

  // State updates happen after render. Keep a completed inspection tied to the
  // profile that requested it so a changed path cannot paint prior contents.
  const loadedContents = contents?.profilePath === profilePath ? contents.data : null;
  const loadedError = error?.profilePath === profilePath ? error.message : null;
  const appCount = loadedContents?.apps.length ?? 0;
  const settingsCount = loadedContents?.settingsApps.length ?? 0;
  const filteredApps =
    loadedContents?.apps.filter((app) =>
      rowMatches(appsQuery, [app.displayName, ...app.packageRefs]),
    ) ?? [];
  const filteredSettings =
    loadedContents?.settingsApps.filter((row) =>
      rowMatches(settingsQuery, [
        row.displayName,
        ...row.packageRefs,
        ...row.moduleIds,
        ...row.candidateAppIds,
      ]),
    ) ?? [];
  const activeQuery = activeTab === "apps" ? appsQuery : settingsQuery;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col gap-4">
        <DialogHeader className="flex-shrink-0 pr-8">
          <DialogTitle>What&apos;s inside</DialogTitle>
          <DialogDescription>
            {profileDisplayName || loadedContents?.profile.name || "This profile"}
            {loadedContents?.profile.capturedAt
              ? ` · captured ${formatCaptured(loadedContents.profile.capturedAt)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {!loading && !loadedError && !loadedContents && !profileInspectionSupported && (
          <p className="text-sm text-muted-foreground">
            Update Endstate to inspect app settings accurately.
          </p>
        )}

        {loading && (
          <p
            className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reading this profile…
          </p>
        )}

        {loadedError && (
          <div
            className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2"
            role="alert"
          >
            <p className="text-sm text-foreground">
              This profile could not be read.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{loadedError}</p>
          </div>
        )}

        {loadedContents && !loading && !loadedError && (
          <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {pluralize(appCount, "app", "apps")}
              </Badge>
              <Badge variant="secondary">
                {pluralize(settingsCount, "app setting", "app settings")}
              </Badge>
              <Badge variant="secondary">
                Settings for{" "}
                {pluralize(
                  loadedContents.summary.verifiedSettingsAppCount,
                  "app",
                  "apps",
                )}
              </Badge>
              {loadedContents.summary.unidentifiedSettingsRowCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {pluralize(
                    loadedContents.summary.unidentifiedSettingsRowCount,
                    "unidentified app settings row",
                    "unidentified app settings rows",
                  )}
                </span>
              )}
              {!loadedContents.profile.capturedAt && (
                <span className="text-xs text-muted-foreground">
                  No capture date recorded
                </span>
              )}
            </div>

            {loadedContents.warnings
              .filter((warning) => warning.impact === "inventory_incomplete")
              .map((warning) => (
                <p
                  key={warning.code}
                  className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground"
                  role="status"
                >
                  {warning.message}
                </p>
              ))}

            {appCount === 0 && settingsCount > 0 && (
              <p className="text-sm text-muted-foreground">
                This profile carries app settings but includes no apps.
              </p>
            )}
            {appCount > 0 && settingsCount === 0 && (
              <p className="text-sm text-muted-foreground">
                This profile includes apps but no app settings.
              </p>
            )}
            {appCount === 0 && settingsCount === 0 && (
              <p className="text-sm text-muted-foreground">
                This profile has no apps or app settings.
              </p>
            )}

            <div
              className="flex flex-shrink-0 gap-1 border-b"
              role="tablist"
              aria-label="Profile contents"
            >
              {(
                [
                  ["apps", `Apps (${appCount})`],
                  ["settings", `App settings (${settingsCount})`],
                ] as const
              ).map(([tab, label]) => (
                <Button
                  key={tab}
                  id={`${tabId}-${tab}-tab`}
                  type="button"
                  variant="ghost"
                  size="sm"
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls={`${tabId}-${tab}-panel`}
                  tabIndex={activeTab === tab ? 0 : -1}
                  onClick={() => chooseTab(tab)}
                  onKeyDown={handleTabKeyDown}
                  className={`rounded-none border-b-2 px-3 py-2 text-sm font-medium ${activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </Button>
              ))}
            </div>

            <Input
              type="search"
              aria-label={
                activeTab === "apps" ? "Search apps" : "Search app settings"
              }
              placeholder={
                activeTab === "apps" ? "Search apps" : "Search app settings"
              }
              value={activeQuery}
              onChange={(event) =>
                activeTab === "apps"
                  ? setAppsQuery(event.target.value)
                  : setSettingsQuery(event.target.value)
              }
              className="flex-shrink-0"
            />

            <div
              data-testid="profile-contents-scroll-region"
              className="min-h-0 flex-1 overflow-y-auto pr-1"
            >
              <div
                id={`${tabId}-apps-panel`}
                role="tabpanel"
                aria-labelledby={`${tabId}-apps-tab`}
                hidden={activeTab !== "apps"}
              >
                {filteredApps.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    {appsQuery.trim()
                      ? `No apps match “${appsQuery.trim()}”.`
                      : "This profile includes no apps."}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {filteredApps.map((app) => (
                      <li
                        key={app.id}
                        className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
                      >
                        <span
                          className="min-w-0 truncate"
                          title={app.displayName}
                        >
                          {app.displayName}
                        </span>
                        {app.hasSettings && (
                          <span className="flex-shrink-0 text-xs text-muted-foreground">
                            Settings included
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div
                id={`${tabId}-settings-panel`}
                role="tabpanel"
                aria-labelledby={`${tabId}-settings-tab`}
                hidden={activeTab !== "settings"}
              >
                {filteredSettings.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    {settingsQuery.trim()
                      ? `No app settings match “${settingsQuery.trim()}”.`
                      : "This profile includes no app settings."}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {filteredSettings.map((row) => (
                      <li
                        key={row.id}
                        className="rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
                      >
                        <p className="truncate" title={row.displayName}>
                          {row.displayName}
                        </p>
                        {settingsAssociationCopy(row) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {settingsAssociationCopy(row)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <DetailsDisclosure title="Configuration details" className="border-t pt-3">
                <dl className="space-y-2 text-xs text-muted-foreground">
                <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                  <dt>Manifest version</dt>
                  <dd className="font-mono">
                    {loadedContents.profile.manifestVersion}
                  </dd>
                </div>
                <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-2">
                  <dt>Path</dt>
                  <dd className="break-all font-mono">
                    {loadedContents.profile.manifestPath}
                  </dd>
                </div>
                {loadedContents.apps.map((app) =>
                  app.packageRefs.length > 0 ? (
                    <div key={app.id} className="border-t pt-2">
                      <dt className="font-medium text-foreground">{app.displayName}</dt>
                      <dd className="mt-1 break-all font-mono">{app.packageRefs.join(", ")}</dd>
                    </div>
                  ) : null,
                )}
                {loadedContents.settingsApps.map((row) => (
                  <div
                    key={row.id}
                    className="border-t pt-2 first:border-t-0 first:pt-0"
                  >
                    <dt className="font-medium text-foreground">
                      {row.displayName}
                    </dt>
                    <dd className="mt-1 break-all font-mono">
                      {row.moduleIds.join(", ")}
                    </dd>
                    {row.packageRefs.length > 0 && (
                      <dd className="mt-1 break-all font-mono">
                        {row.packageRefs.join(", ")}
                      </dd>
                    )}
                    {row.candidateAppIds.length > 0 && (
                      <dd className="mt-1 break-all font-mono">
                        Candidates: {row.candidateAppIds.join(", ")}
                      </dd>
                    )}
                    <dd className="mt-1">
                      {pluralize(
                        row.capturedEntryCount,
                        "captured entry",
                        "captured entries",
                      )}
                    </dd>
                  </div>
                ))}
                {loadedContents.warnings
                  .filter((warning) => warning.impact === "diagnostic")
                  .map((warning) => (
                    <div key={warning.code} className="border-t pt-2">
                      <dt className="font-medium text-foreground">
                        {warning.code}
                      </dt>
                      <dd>{warning.message}</dd>
                    </div>
                  ))}
                </dl>
              </DetailsDisclosure>
            </div>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 pt-2">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
