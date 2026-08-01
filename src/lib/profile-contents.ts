/** Read-only bridge for the engine-owned `profile inspect` contract. */

import { z } from "zod";
import { runEndstateOnce } from "./engine-exec";
import type { AppSettings } from "../settings";
import type { EndstateEnvelope, ProfileInspectionData } from "../types";

const nonNegativeInteger = z.number().int().nonnegative();
const associationStatus = z.enum([
  "included",
  "not_in_profile",
  "ambiguous",
  "unresolved",
]);

const inspectionAppSchema = z
  .object({
    id: z.string(),
    manifestAppId: z.string(),
    displayName: z.string(),
    packageRefs: z.array(z.string()),
    hasSettings: z.boolean(),
  })
  .passthrough();

const inspectionSettingsAppSchema = z
  .object({
    id: z.string(),
    displayName: z.string(),
    associationStatus,
    ownerId: z.string().nullable(),
    appId: z.string().nullable(),
    appIncluded: z.boolean(),
    packageRefs: z.array(z.string()),
    moduleIds: z.array(z.string()),
    candidateAppIds: z.array(z.string()),
    capturedEntryCount: nonNegativeInteger,
  })
  .passthrough();

const inspectionDataSchema = z
  .object({
    profile: z
      .object({
        name: z.string().nullable(),
        capturedAt: z.string().nullable(),
        manifestVersion: z.number().int(),
        manifestPath: z.string(),
      })
      .passthrough(),
    summary: z
      .object({
        appCount: nonNegativeInteger,
        settingsRowCount: nonNegativeInteger,
        verifiedSettingsAppCount: nonNegativeInteger,
        unidentifiedSettingsRowCount: nonNegativeInteger,
      })
      .passthrough(),
    apps: z.array(inspectionAppSchema),
    settingsApps: z.array(inspectionSettingsAppSchema),
    warnings: z.array(
      z
        .object({
          code: z.string(),
          message: z.string(),
          impact: z.enum(["diagnostic", "inventory_incomplete"]),
        })
        .passthrough(),
    ),
  })
  .passthrough();

const inspectionEnvelopeSchema = z
  .object({
    schemaVersion: z.string().regex(/^1\.\d+$/),
    cliVersion: z.string().min(1),
    command: z.literal("profile"),
    runId: z.string().min(1),
    timestampUtc: z.string().min(1),
    success: z.literal(true),
    data: inspectionDataSchema,
    error: z.null(),
  })
  .passthrough();

/** Structured error from the read-only profile inspection command. */
export class ProfileInspectionError extends Error {
  readonly code: string;
  readonly remediation?: string;
  readonly detail?: Record<string, unknown>;

  constructor(args: {
    code: string;
    message: string;
    remediation?: string;
    detail?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = "ProfileInspectionError";
    this.code = args.code;
    this.remediation = args.remediation;
    this.detail = args.detail;
  }
}
function incompatibleInspectionResponse(): ProfileInspectionError {
  return new ProfileInspectionError({
    code: "INCOMPATIBLE_PROFILE_INSPECTION_RESPONSE",
    message:
      "Incompatible profile inspection response. Please update Endstate and try again.",
  });
}

function sameWindowsPath(left: string, right: string): boolean {
  const normalize = (path: string) => {
    const windowsPath = path.replace(/\//g, "\\");
    const isUnc = windowsPath.startsWith("\\\\");
    const compactPath = windowsPath.replace(/\\{2,}/g, "\\");
    return `${isUnc ? "\\" : ""}${compactPath}`.toLowerCase();
  };
  return normalize(left) === normalize(right);
}

function validateInspectionRelations(
  data: ProfileInspectionData,
  manifestPath: string,
): void {
  if (!sameWindowsPath(data.profile.manifestPath, manifestPath)) {
    throw incompatibleInspectionResponse();
  }

  const appsById = new Map(data.apps.map((app) => [app.id, app]));
  if (appsById.size !== data.apps.length)
    throw incompatibleInspectionResponse();

  const settingsRowIds = new Set<string>();
  const includedAppIds = new Set<string>();
  const verifiedOwnerIds = new Set<string>();
  let unidentifiedSettingsRowCount = 0;

  for (const row of data.settingsApps) {
    if (settingsRowIds.has(row.id)) throw incompatibleInspectionResponse();
    settingsRowIds.add(row.id);

    if (
      !row.candidateAppIds.every((candidateId) => appsById.has(candidateId))
    ) {
      throw incompatibleInspectionResponse();
    }
    switch (row.associationStatus) {
      case "included":
        if (
          !row.ownerId ||
          !row.appId ||
          row.ownerId !== row.appId ||
          !row.appIncluded ||
          row.candidateAppIds.length !== 1 ||
          row.candidateAppIds[0] !== row.appId ||
          !appsById.has(row.appId)
        ) {
          throw incompatibleInspectionResponse();
        }
        includedAppIds.add(row.appId);
        if (verifiedOwnerIds.has(row.ownerId)) throw incompatibleInspectionResponse();
        verifiedOwnerIds.add(row.ownerId);
        break;
      case "not_in_profile":
        if (
          !row.ownerId ||
          row.appId !== null ||
          row.appIncluded ||
          row.candidateAppIds.length !== 0
        ) {
          throw incompatibleInspectionResponse();
        }
        if (verifiedOwnerIds.has(row.ownerId)) throw incompatibleInspectionResponse();
        verifiedOwnerIds.add(row.ownerId);
        break;
      case "ambiguous":
        if (
          row.ownerId !== null ||
          row.appId !== null ||
          row.appIncluded ||
          row.candidateAppIds.length < 2 ||
          new Set(row.candidateAppIds).size !== row.candidateAppIds.length
        ) {
          throw incompatibleInspectionResponse();
        }
        unidentifiedSettingsRowCount += 1;
        break;
      case "unresolved":
        if (
          row.ownerId !== null ||
          row.appId !== null ||
          row.appIncluded ||
          row.candidateAppIds.length !== 0
        ) {
          throw incompatibleInspectionResponse();
        }
        unidentifiedSettingsRowCount += 1;
        break;
    }
  }

  for (const app of data.apps) {
    if (app.hasSettings !== includedAppIds.has(app.id))
      throw incompatibleInspectionResponse();
  }
  if (
    data.summary.appCount !== data.apps.length ||
    data.summary.settingsRowCount !== data.settingsApps.length ||
    data.summary.verifiedSettingsAppCount !== verifiedOwnerIds.size ||
    data.summary.unidentifiedSettingsRowCount !== unidentifiedSettingsRowCount
  ) {
    throw incompatibleInspectionResponse();
  }
}

/** Reads one extracted profile through the engine; the GUI never parses its manifest. */
export async function inspectProfileContents(
  settings: AppSettings,
  manifestPath: string,
): Promise<ProfileInspectionData> {
  const result = await runEndstateOnce<EndstateEnvelope<unknown>>(
    settings,
    "profile",
    ["inspect", manifestPath],
  );
  if (!result.success) {
    const envelope = result.envelope as EndstateEnvelope<unknown> | undefined;
    if (envelope?.error) {
      throw new ProfileInspectionError({
        code: envelope.error.code,
        message: envelope.error.message,
        remediation: envelope.error.remediation,
        detail: envelope.error.detail,
      });
    }
    throw new ProfileInspectionError({
      code: result.error.kind.toUpperCase(),
      message: result.error.message,
      detail: result.error.stderr ? { stderr: result.error.stderr } : undefined,
    });
  }
  const parsed = inspectionEnvelopeSchema.safeParse(result.envelope);
  if (!parsed.success) throw incompatibleInspectionResponse();
  const data = parsed.data.data as ProfileInspectionData;
  validateInspectionRelations(data, manifestPath);
  return data;
}
