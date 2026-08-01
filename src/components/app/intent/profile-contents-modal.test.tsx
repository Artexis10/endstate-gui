import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "../../../test/test-utils";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ProfileContentsModal } from "./profile-contents-modal";
import { useShowDetails } from "@/lib/use-show-details";
import type { ProfileInspectionData } from "@/types";

vi.mock("@/lib/use-show-details", () => ({
  useShowDetails: vi.fn(() => false),
}));

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  profilePath: "C:\\Setups\\my-desktop\\manifest.jsonc",
  profileDisplayName: "My desktop",
  profileInspectionSupported: true,
};

function inspection(
  overrides: Partial<ProfileInspectionData> = {},
): ProfileInspectionData {
  const apps = [
    {
      id: "app:vlc:1",
      manifestAppId: "vlc",
      displayName: "VLC media player",
      packageRefs: ["VideoLAN.VLC"],
      hasSettings: true,
    },
    {
      id: "app:obsidian:1",
      manifestAppId: "obsidian",
      displayName: "Obsidian",
      packageRefs: ["Obsidian.Obsidian"],
      hasSettings: false,
    },
  ];
  const settingsApps = [
    {
      id: "settings:vlc",
      displayName: "VLC media player",
      associationStatus: "included" as const,
      ownerId: "app:vlc:1",
      appId: "app:vlc:1",
      appIncluded: true,
      packageRefs: ["VideoLAN.VLC"],
      moduleIds: ["apps.vlc"],
      candidateAppIds: ["app:vlc:1"],
      capturedEntryCount: 2,
    },
    {
      id: "settings:steam",
      displayName: "Steam",
      associationStatus: "not_in_profile" as const,
      ownerId: "owner:steam",
      appId: null,
      appIncluded: false,
      packageRefs: ["Valve.Steam"],
      moduleIds: ["apps.steam"],
      candidateAppIds: [],
      capturedEntryCount: 1,
    },
    {
      id: "settings:unknown",
      displayName: "Unidentified app settings",
      associationStatus: "unresolved" as const,
      ownerId: null,
      appId: null,
      appIncluded: false,
      packageRefs: [],
      moduleIds: ["apps.unknown"],
      candidateAppIds: [],
      capturedEntryCount: 3,
    },
  ];
  return {
    profile: {
      name: "my-desktop",
      capturedAt: "2026-07-18T12:00:00Z",
      manifestVersion: 2,
      manifestPath: defaultProps.profilePath,
    },
    summary: {
      appCount: apps.length,
      settingsRowCount: settingsApps.length,
      verifiedSettingsAppCount: 2,
      unidentifiedSettingsRowCount: 1,
    },
    apps,
    settingsApps,
    warnings: [],
    ...overrides,
  };
}

function renderModal(
  data = inspection(),
  props: Partial<React.ComponentProps<typeof ProfileContentsModal>> = {},
) {
  const onInspectProfile = vi.fn().mockResolvedValue(data);
  render(
    <ProfileContentsModal
      {...defaultProps}
      onInspectProfile={onInspectProfile}
      {...props}
    />,
  );
  return { onInspectProfile };
}

describe("ProfileContentsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useShowDetails).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders semantic Apps and App settings totals from the engine result", async () => {
    renderModal();

    expect(await screen.findByText("2 apps")).toBeVisible();
    expect(screen.getByText("3 app settings")).toBeVisible();
    expect(screen.getByText("Settings for 2 apps")).toBeVisible();
    expect(screen.getByText("1 unidentified app settings row")).toBeVisible();
  });

  it("describes 72 apps and settings for 8 apps without counting files as settings", async () => {
    const apps = Array.from({ length: 72 }, (_, index) => ({
      id: `app:${index}`,
      manifestAppId: `app-${index}`,
      displayName: `App ${index}`,
      packageRefs: [],
      hasSettings: index < 8,
    }));
    const settingsApps = apps.slice(0, 8).map((app, index) => ({
      id: `settings:${index}`,
      displayName: app.displayName,
      associationStatus: "included" as const,
      ownerId: app.id,
      appId: app.id,
      appIncluded: true,
      packageRefs: [],
      moduleIds: [`apps.${index}`],
      candidateAppIds: [app.id],
      capturedEntryCount: index + 1,
    }));
    renderModal(
      inspection({
        apps,
        settingsApps,
        summary: {
          appCount: 72,
          settingsRowCount: 8,
          verifiedSettingsAppCount: 8,
          unidentifiedSettingsRowCount: 0,
        },
      }),
    );

    expect(await screen.findByText("72 apps")).toBeVisible();
    expect(screen.getByText("8 app settings")).toBeVisible();
    expect(screen.getByText("Settings for 8 apps")).toBeVisible();
    expect(screen.queryByText("1 captured entry")).not.toBeInTheDocument();
  });

  it("shows only the Apps tab initially and marks settings-bearing apps quietly", async () => {
    renderModal();

    const appsTab = await screen.findByRole("tab", { name: "Apps (2)" });
    expect(appsTab).toHaveAttribute("aria-selected", "true");
    expect(
      within(document.getElementById(appsTab.getAttribute("aria-controls")!)!).getByText(
        "VLC media player",
      ),
    ).toBeVisible();
    expect(screen.getByText("Settings included")).toBeVisible();
    expect(screen.getByText("App not included")).not.toBeVisible();
  });

  it("uses App settings as the default tab for a settings-only profile", async () => {
    const data = inspection({
      apps: [],
      summary: {
        appCount: 0,
        settingsRowCount: 3,
        verifiedSettingsAppCount: 2,
        unidentifiedSettingsRowCount: 1,
      },
    });
    renderModal(data);

    expect(
      await screen.findByRole("tab", { name: "App settings (3)" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByText(
        "This profile carries app settings but includes no apps.",
      ),
    ).toBeVisible();
  });

  it("supports standard keyboard tab activation and focus movement", async () => {
    const user = userEvent.setup();
    renderModal();

    const apps = await screen.findByRole("tab", { name: "Apps (2)" });
    const settings = screen.getByRole("tab", { name: "App settings (3)" });
    apps.focus();
    await user.keyboard("{ArrowRight}");
    expect(settings).toHaveFocus();
    expect(settings).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(apps).toHaveFocus();
    expect(apps).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(settings).toHaveFocus();
    expect(settings).toHaveAttribute("aria-selected", "true");
  });

  it("wraps tab arrows and keeps every tab's controlled panel in the DOM", async () => {
    const user = userEvent.setup();
    renderModal();

    const apps = await screen.findByRole("tab", { name: "Apps (2)" });
    const settings = screen.getByRole("tab", { name: "App settings (3)" });
    for (const tab of [apps, settings]) {
      expect(document.getElementById(tab.getAttribute("aria-controls")!)).toHaveAttribute(
        "role",
        "tabpanel",
      );
    }

    apps.focus();
    await user.keyboard("{ArrowLeft}");
    expect(settings).toHaveFocus();
    expect(settings).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(apps).toHaveFocus();
    expect(apps).toHaveAttribute("aria-selected", "true");
  });

  it("scopes search to the active tab and preserves queries when switching", async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByRole("tab", { name: "Apps (2)" });

    await user.type(
      screen.getByRole("searchbox", { name: "Search apps" }),
      "obsidian",
    );
    expect(screen.getByText("Obsidian")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "App settings (3)" }));
    await user.type(
      screen.getByRole("searchbox", { name: "Search app settings" }),
      "steam",
    );
    expect(screen.getByText("Steam")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Apps (2)" }));
    expect(screen.getByRole("searchbox", { name: "Search apps" })).toHaveValue(
      "obsidian",
    );
  });

  it("matches ordinary search text independently of locale casing rules", async () => {
    vi.spyOn(String.prototype, "toLocaleLowerCase")
      .mockImplementation(function (this: string) {
        return this.replace(/I/g, "ı").toLowerCase();
      });
    const user = userEvent.setup();
    renderModal(
      inspection({
        apps: [
          {
            id: "app:irfanview:1",
            manifestAppId: "irfanview",
            displayName: "IrfanView",
            packageRefs: [],
            hasSettings: false,
          },
        ],
        settingsApps: [],
        summary: {
          appCount: 1,
          settingsRowCount: 0,
          verifiedSettingsAppCount: 0,
          unidentifiedSettingsRowCount: 0,
        },
      }),
    );
    await screen.findByRole("searchbox", { name: "Search apps" });

    await user.type(
      screen.getByRole("searchbox", { name: "Search apps" }),
      "irfanview",
    );

    expect(screen.getByText("IrfanView")).toBeVisible();
  });

  it("shows calm no-results copy without changing totals", async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByRole("searchbox", { name: "Search apps" });

    await user.type(
      screen.getByRole("searchbox", { name: "Search apps" }),
      "missing",
    );
    expect(screen.getByText("No apps match “missing”.")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Apps (2)" })).toBeVisible();
  });

  it("labels settings-only apps and leaves unidentified rows unassociated", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(
      await screen.findByRole("tab", { name: "App settings (3)" }),
    );

    expect(screen.getByText("App not included")).toBeVisible();
    expect(screen.getByText("Unidentified app settings")).toBeVisible();
    expect(
      screen.getByText("Association could not be identified."),
    ).toBeVisible();
  });

  it("keeps technical provenance behind Configuration details", async () => {
    vi.mocked(useShowDetails).mockReturnValue(true);
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("2 apps");

    expect(screen.queryByText("apps.vlc")).not.toBeInTheDocument();
    expect(
      screen.queryByText(defaultProps.profilePath),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Configuration details" }),
    );
    expect(screen.getByText("apps.vlc")).toBeVisible();
    expect(screen.getByText(defaultProps.profilePath)).toBeVisible();
    expect(screen.getByText("2 captured entries")).toBeVisible();
  });

  it("keeps app package refs hidden by default and shows them for install-only profiles in details", async () => {
    vi.mocked(useShowDetails).mockReturnValue(true);
    const user = userEvent.setup();
    renderModal(
      inspection({
        apps: [{
          id: "app:solo:1", manifestAppId: "solo", displayName: "Solo app",
          packageRefs: ["Example.Solo"], hasSettings: false,
        }],
        settingsApps: [],
        summary: { appCount: 1, settingsRowCount: 0, verifiedSettingsAppCount: 0, unidentifiedSettingsRowCount: 0 },
      }),
    );
    await screen.findByText("1 app");
    expect(screen.queryByText("Example.Solo")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Configuration details" }));
    expect(screen.getByText("Example.Solo")).toBeVisible();
  });

  it("keeps expanded details inside the only scrollable content region", async () => {
    vi.mocked(useShowDetails).mockReturnValue(true);
    const user = userEvent.setup();
    renderModal();
    await screen.findByText("2 apps");
    await user.click(screen.getByRole("button", { name: "Configuration details" }));

    const scrollRegion = screen.getByTestId("profile-contents-scroll-region");
    expect(scrollRegion).toHaveClass("overflow-y-auto");
    expect(scrollRegion).toContainElement(screen.getByText(defaultProps.profilePath));
  });

  it("shows inventory-completeness warnings but keeps diagnostics in details", async () => {
    vi.mocked(useShowDetails).mockReturnValue(true);
    const user = userEvent.setup();
    renderModal(
      inspection({
        warnings: [
          {
            code: "PARTIAL",
            message: "Some settings could not be inventoried.",
            impact: "inventory_incomplete",
          },
          { code: "TRACE", message: "Technical trace.", impact: "diagnostic" },
        ],
      }),
    );
    expect(
      await screen.findByText("Some settings could not be inventoried."),
    ).toBeVisible();
    expect(screen.queryByText("Technical trace.")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Configuration details" }),
    );
    expect(screen.getByText("Technical trace.")).toBeVisible();
  });

  it("states when the profile has no recorded capture date", async () => {
    renderModal(
      inspection({ profile: { ...inspection().profile, capturedAt: null } }),
    );

    expect(await screen.findByText("No capture date recorded")).toBeVisible();
  });

  it("surfaces a structured inspection failure instead of an empty inventory", async () => {
    const onInspectProfile = vi
      .fn()
      .mockRejectedValue(new Error("MANIFEST_INVALID: missing apps"));
    render(
      <ProfileContentsModal
        {...defaultProps}
        onInspectProfile={onInspectProfile}
      />,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This profile could not be read.");
    expect(alert).toHaveTextContent("MANIFEST_INVALID: missing apps");
  });

  it("resets both tab queries when reopened", async () => {
    const user = userEvent.setup();
    const onInspectProfile = vi.fn().mockResolvedValue(inspection());
    const { rerender } = render(
      <ProfileContentsModal
        {...defaultProps}
        onInspectProfile={onInspectProfile}
      />,
    );
    await screen.findByRole("searchbox", { name: "Search apps" });
    await user.type(
      screen.getByRole("searchbox", { name: "Search apps" }),
      "obsidian",
    );
    rerender(
      <ProfileContentsModal
        {...defaultProps}
        open={false}
        onInspectProfile={onInspectProfile}
      />,
    );
    rerender(
      <ProfileContentsModal
        {...defaultProps}
        open
        onInspectProfile={onInspectProfile}
      />,
    );
    expect(
      await screen.findByRole("searchbox", { name: "Search apps" }),
    ).toHaveValue("");
  });

  it("shows an update-required state without inspection on stale engines", async () => {
    const onInspectProfile = vi.fn();
    render(
      <ProfileContentsModal
        {...defaultProps}
        profileInspectionSupported={false}
        onInspectProfile={onInspectProfile}
      />,
    );

    expect(
      await screen.findByText(
        "Update Endstate to inspect app settings accurately.",
      ),
    ).toBeVisible();
    expect(onInspectProfile).not.toHaveBeenCalled();
  });

  it("suppresses a stale inspection response after the profile changes", async () => {
    let resolveFirst: (data: ProfileInspectionData) => void = () => undefined;
    const first = new Promise<ProfileInspectionData>((resolve) => {
      resolveFirst = resolve;
    });
    const onInspectProfile = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(
        inspection({ profile: { ...inspection().profile, name: "second" } }),
      );
    const { rerender } = render(
      <ProfileContentsModal
        {...defaultProps}
        onInspectProfile={onInspectProfile}
      />,
    );
    rerender(
      <ProfileContentsModal
        {...defaultProps}
        profilePath="C:\\Setups\\second\\manifest.jsonc"
        onInspectProfile={onInspectProfile}
      />,
    );
    await screen.findByText("2 apps");
    resolveFirst(
      inspection({ profile: { ...inspection().profile, name: "stale" } }),
    );
    await waitFor(() =>
      expect(screen.queryByText("stale")).not.toBeInTheDocument(),
    );
  });

  it("never renders loaded contents for a previous profile path", async () => {
    let resolveCurrent: (data: ProfileInspectionData) => void = () => undefined;
    const current = new Promise<ProfileInspectionData>((resolve) => { resolveCurrent = resolve; });
    const old = inspection({ apps: [{
      id: "app:old:1", manifestAppId: "old", displayName: "Old profile app",
      packageRefs: [], hasSettings: false,
    }], settingsApps: [], summary: { appCount: 1, settingsRowCount: 0, verifiedSettingsAppCount: 0, unidentifiedSettingsRowCount: 0 } });
    const onInspectProfile = vi.fn().mockResolvedValueOnce(old).mockReturnValueOnce(current);
    const { rerender } = render(<ProfileContentsModal {...defaultProps} onInspectProfile={onInspectProfile} />);
    expect(await screen.findByText("Old profile app")).toBeVisible();

    rerender(<ProfileContentsModal {...defaultProps} profilePath="C:\\Setups\\current\\manifest.jsonc" onInspectProfile={onInspectProfile} />);
    expect(screen.queryByText("Old profile app")).not.toBeInTheDocument();
    resolveCurrent(inspection());
    expect(
      await within(await screen.findByRole("tabpanel")).findByText("VLC media player"),
    ).toBeVisible();
  });

  it("never renders an inspection error for a previous profile path", async () => {
    let resolveCurrent: (data: ProfileInspectionData) => void = () => undefined;
    const current = new Promise<ProfileInspectionData>((resolve) => { resolveCurrent = resolve; });
    const onInspectProfile = vi
      .fn()
      .mockRejectedValueOnce(new Error("A profile could not be read"))
      .mockReturnValueOnce(current);
    const { rerender } = render(<ProfileContentsModal {...defaultProps} onInspectProfile={onInspectProfile} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("A profile could not be read");

    rerender(<ProfileContentsModal {...defaultProps} profilePath="C:\\Setups\\current\\manifest.jsonc" onInspectProfile={onInspectProfile} />);
    expect(screen.queryByText("A profile could not be read")).not.toBeInTheDocument();
    resolveCurrent(inspection());
    expect(await screen.findByRole("tabpanel")).toBeVisible();
  });
});
