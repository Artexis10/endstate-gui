import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  inspectProfileContents,
  ProfileInspectionError,
} from "./profile-contents";
import type { AppSettings } from "../settings";

vi.mock("./engine-exec", () => ({ runEndstateOnce: vi.fn() }));

const SETTINGS = {
  engineMode: "bundled",
  customProfilesDirectory: "",
} as AppSettings;

function inspectionEnvelope() {
  return {
    schemaVersion: "1.0",
    cliVersion: "2.30.0",
    command: "profile",
    runId: "run-1",
    timestampUtc: "2026-08-01T12:00:00Z",
    success: true,
    error: null,
    data: {
      profile: {
        name: null,
        capturedAt: null,
        manifestVersion: 2,
        manifestPath: "C:\\Profiles\\example\\manifest.jsonc",
      },
      summary: {
        appCount: 2,
        settingsRowCount: 4,
        verifiedSettingsAppCount: 2,
        unidentifiedSettingsRowCount: 2,
      },
      apps: [
        {
          id: "app:one:1",
          manifestAppId: "one",
          displayName: "One",
          packageRefs: ["Example.One"],
          hasSettings: true,
        },
        {
          id: "app:two:1",
          manifestAppId: "two",
          displayName: "Two",
          packageRefs: [],
          hasSettings: false,
        },
      ],
      settingsApps: [
        {
          id: "settings:app:one:1",
          displayName: "One settings",
          associationStatus: "included",
          ownerId: "app:one:1",
          appId: "app:one:1",
          appIncluded: true,
          packageRefs: ["Example.One"],
          moduleIds: ["one"],
          candidateAppIds: ["app:one:1"],
          capturedEntryCount: 3,
        },
        {
          id: "settings:absent",
          displayName: "Absent settings",
          associationStatus: "not_in_profile",
          ownerId: "owner:absent",
          appId: null,
          appIncluded: false,
          packageRefs: ["Example.Absent"],
          moduleIds: ["absent"],
          candidateAppIds: [],
          capturedEntryCount: 0,
        },
        {
          id: "settings:module:ambiguous",
          displayName: "Ambiguous settings",
          associationStatus: "ambiguous",
          ownerId: null,
          appId: null,
          appIncluded: false,
          packageRefs: ["Example.One", "Example.Two"],
          moduleIds: ["ambiguous"],
          candidateAppIds: ["app:one:1", "app:two:1"],
          capturedEntryCount: 1,
        },
        {
          id: "settings:module:unresolved",
          displayName: "Unresolved settings",
          associationStatus: "unresolved",
          ownerId: null,
          appId: null,
          appIncluded: false,
          packageRefs: [],
          moduleIds: ["unresolved"],
          candidateAppIds: [],
          capturedEntryCount: 1,
        },
      ],
      warnings: [
        { code: "DIAGNOSTIC", message: "Useful detail", impact: "diagnostic" },
      ],
    },
  };
}

async function mockInspection(envelope = inspectionEnvelope()) {
  const { runEndstateOnce } = await import("./engine-exec");
  vi.mocked(runEndstateOnce).mockResolvedValue({
    success: true,
    envelope,
  } as never);
}

describe("inspectProfileContents", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await mockInspection();
  });

  it("calls only profile inspect with the supplied manifest path and preserves engine order", async () => {
    const contents = await inspectProfileContents(
      SETTINGS,
      "C:\\Profiles\\example\\manifest.jsonc",
    );
    const { runEndstateOnce } = await import("./engine-exec");

    expect(runEndstateOnce).toHaveBeenCalledWith(SETTINGS, "profile", [
      "inspect",
      "C:\\Profiles\\example\\manifest.jsonc",
    ]);
    expect(contents.apps.map((app) => app.displayName)).toEqual(["One", "Two"]);
  });

  it.each([
    [
      "non-1.x schema",
      (envelope: any) => {
        envelope.schemaVersion = "2.0";
      },
    ],
    [
      "missing cli version",
      (envelope: any) => {
        delete envelope.cliVersion;
      },
    ],
    [
      "wrong command",
      (envelope: any) => {
        envelope.command = "inspect";
      },
    ],
    [
      "failed success flag",
      (envelope: any) => {
        envelope.success = false;
      },
    ],
    [
      "non-null success error",
      (envelope: any) => {
        envelope.error = { code: "BAD" };
      },
    ],
    [
      "missing timestamp",
      (envelope: any) => {
        delete envelope.timestampUtc;
      },
    ],
    [
      "missing apps",
      (envelope: any) => {
        delete envelope.data.apps;
      },
    ],
    [
      "null settingsApps",
      (envelope: any) => {
        envelope.data.settingsApps = null;
      },
    ],
    [
      "missing profile path",
      (envelope: any) => {
        delete envelope.data.profile.manifestPath;
      },
    ],
    [
      "unknown association status",
      (envelope: any) => {
        envelope.data.settingsApps[0].associationStatus = "maybe";
      },
    ],
    [
      "negative entry count",
      (envelope: any) => {
        envelope.data.settingsApps[0].capturedEntryCount = -1;
      },
    ],
    [
      "unknown warning impact",
      (envelope: any) => {
        envelope.data.warnings[0].impact = "unknown";
      },
    ],
  ])("fails closed on a %s response", async (_name, mutate) => {
    const envelope = inspectionEnvelope();
    mutate(envelope);
    await mockInspection(envelope);
    await expect(
      inspectProfileContents(SETTINGS, "C:\\Profiles\\example\\manifest.jsonc"),
    ).rejects.toThrow(/incompatible profile inspection response/i);
  });

  it.each([
    [
      "included lacks its sole owner",
      (row: any) => {
        row.ownerId = null;
      },
    ],
    [
      "included is not included",
      (row: any) => {
        row.appIncluded = false;
      },
    ],
    [
      "included has a missing candidate",
      (row: any) => {
        row.candidateAppIds = [];
      },
    ],
    [
      "not-in-profile has an app id",
      (row: any) => {
        row.appId = "app:one:1";
      },
    ],
    [
      "ambiguous lacks two unique candidates",
      (row: any) => {
        row.candidateAppIds = ["app:one:1"];
      },
    ],
    [
      "unresolved has candidates",
      (row: any) => {
        row.candidateAppIds = ["app:one:1"];
      },
    ],
  ])("rejects invalid association semantics when %s", async (_name, mutate) => {
    const envelope = inspectionEnvelope();
    const row = _name.startsWith("included")
      ? envelope.data.settingsApps[0]
      : _name.startsWith("not-in-profile")
        ? envelope.data.settingsApps[1]
        : _name.startsWith("ambiguous")
          ? envelope.data.settingsApps[2]
          : envelope.data.settingsApps[3];
    mutate(row);
    await mockInspection(envelope);
    await expect(
      inspectProfileContents(SETTINGS, "C:\\Profiles\\example\\manifest.jsonc"),
    ).rejects.toThrow(/incompatible profile inspection response/i);
  });

  it.each([
    [
      "summary counts disagree",
      (envelope: any) => {
        envelope.data.summary.appCount = 1;
      },
    ],
    [
      "an included row points to an unknown app",
      (envelope: any) => {
        envelope.data.settingsApps[0].appId = "missing";
        envelope.data.settingsApps[0].ownerId = "missing";
        envelope.data.settingsApps[0].candidateAppIds = ["missing"];
      },
    ],
    [
      "an app disagrees about settings",
      (envelope: any) => {
        envelope.data.apps[0].hasSettings = false;
      },
    ],
  ])("rejects when %s", async (_name, mutate) => {
    const envelope = inspectionEnvelope();
    mutate(envelope);
    await mockInspection(envelope);
    await expect(
      inspectProfileContents(SETTINGS, "C:\\Profiles\\example\\manifest.jsonc"),
    ).rejects.toThrow(/incompatible profile inspection response/i);
  });

  it("surfaces the engine structured failure without attempting a local fallback", async () => {
    const { runEndstateOnce } = await import("./engine-exec");
    vi.mocked(runEndstateOnce).mockResolvedValue({
      success: false,
      error: { kind: "command_failed", message: "Manifest was invalid" },
      envelope: {
        error: {
          code: "MANIFEST_VALIDATION_ERROR",
          message: "Manifest was invalid",
        },
      },
    } as never);

    await expect(
      inspectProfileContents(SETTINGS, "C:\\Profiles\\example\\manifest.jsonc"),
    ).rejects.toMatchObject({
      name: "ProfileInspectionError",
      code: "MANIFEST_VALIDATION_ERROR",
      message: "Manifest was invalid",
    });
    await expect(
      inspectProfileContents(SETTINGS, "C:\\Profiles\\example\\manifest.jsonc"),
    ).rejects.toBeInstanceOf(ProfileInspectionError);
  });
});
