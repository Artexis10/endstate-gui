import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, within } from "../../../test/test-utils";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { SetupFlow } from "./setup-flow";
import type { DiscoveredProfile } from "../../../file-discovery";
import type { ProfileInspectionData } from "@/types";

const profiles: DiscoveredProfile[] = [
  {
    name: "work-laptop",
    path: "C:\\Setups\\work-laptop\\manifest.jsonc",
    displayName: "Work Laptop",
  },
];

const contents: ProfileInspectionData = {
  profile: {
    name: "work-laptop",
    capturedAt: null,
    manifestVersion: 2,
    manifestPath: profiles[0].path,
  },
  summary: {
    appCount: 1,
    settingsRowCount: 1,
    verifiedSettingsAppCount: 1,
    unidentifiedSettingsRowCount: 0,
  },
  apps: [
    {
      id: "app:vlc:1",
      manifestAppId: "vlc",
      displayName: "VLC media player",
      packageRefs: ["VideoLAN.VLC"],
      hasSettings: true,
    },
  ],
  settingsApps: [
    {
      id: "settings:vlc",
      displayName: "VLC media player",
      associationStatus: "included",
      ownerId: "app:vlc:1",
      appId: "app:vlc:1",
      appIncluded: true,
      packageRefs: ["VideoLAN.VLC"],
      moduleIds: ["apps.vlc"],
      candidateAppIds: ["app:vlc:1"],
      capturedEntryCount: 1,
    },
  ],
  warnings: [],
};

const baseProps = {
  profiles,
  onBack: vi.fn(),
  onOpenProfilesFolder: vi.fn(),
  onRefreshProfiles: vi.fn().mockResolvedValue(undefined),
  onFileDrop: vi.fn(),
  onDeleteProfile: vi.fn(),
  isRunning: false,
  setupProgress: null,
  liveAppEvents: [],
  onPreview: vi.fn(),
  onApply: vi.fn(),
  profileInspectionSupported: true,
  onInspectProfile: vi.fn().mockResolvedValue(contents),
};

describe('SetupFlow — "What\'s inside"', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers a "What\'s inside" affordance on each profile card', () => {
    renderWithProviders(<SetupFlow {...baseProps} />);
    expect(
      screen.getByRole("button", { name: "What's inside Work Laptop" }),
    ).toBeInTheDocument();
  });

  it("inspects the exact manifest without selecting, previewing, detecting, or applying", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SetupFlow {...baseProps} />);

    await user.click(
      screen.getByRole("button", { name: "What's inside Work Laptop" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(within(dialog).getByRole("tabpanel")).getByText("VLC media player")).toBeVisible();
    expect(baseProps.onInspectProfile).toHaveBeenCalledWith(profiles[0].path);
    expect(baseProps.onPreview).not.toHaveBeenCalled();
    expect(baseProps.onApply).not.toHaveBeenCalled();
  });

  it.each(["{Enter}", " "])(
    "opens with %s without selecting the profile",
    async (key) => {
      const user = userEvent.setup();
      renderWithProviders(<SetupFlow {...baseProps} />);

      screen
        .getByRole("button", { name: "What's inside Work Laptop" })
        .focus();
      await user.keyboard(key);

      expect(await screen.findByRole("dialog")).toBeVisible();
      expect(baseProps.onInspectProfile).toHaveBeenCalledWith(profiles[0].path);
      expect(baseProps.onPreview).not.toHaveBeenCalled();
      expect(baseProps.onApply).not.toHaveBeenCalled();
    },
  );

  it("shows the update-required state without invoking inspection on an older engine", async () => {
    const user = userEvent.setup();
    const onInspectProfile = vi.fn();
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        profileInspectionSupported={false}
        onInspectProfile={onInspectProfile}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "What's inside Work Laptop" }),
    );
    expect(
      await screen.findByText(
        "Update Endstate to inspect app settings accurately.",
      ),
    ).toBeVisible();
    expect(onInspectProfile).not.toHaveBeenCalled();
  });
});
