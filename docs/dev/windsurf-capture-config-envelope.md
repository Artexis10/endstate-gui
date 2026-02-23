/opsx:new capture-config-envelope — Surface structured config module metadata in capture JSON envelope

Goal: The capture `--json` envelope currently includes flat string arrays for config modules (configsIncluded, configsSkipped, configsCaptureErrors). The GUI needs structured per-module metadata to associate config modules with their parent apps without heuristic string matching. Surface the data that already exists internally in the engine into the JSON envelope.

Context:
- `New-CaptureBundle` in engine/bundle.ps1 already calls `Get-MatchedConfigModulesForApps` which returns full module objects with id, displayName, matches.winget
- `Invoke-CollectConfigFiles` in engine/bundle.ps1 already tracks per-module included/skipped/error status
- The capture result in engine/capture.ps1 already has `ConfigCapture.modules` with id, displayName, entries, files
- The JSON envelope in bin/endstate.ps1 capture handler currently only surfaces: outputFormat, configsIncluded (string[]), configsSkipped (string[]), configsCaptureErrors (string[])
- Module IDs follow pattern "apps.<app-id>" (e.g., "apps.vscode") — appId is derivable by stripping the "apps." prefix
- An OpenSpec already exists at openspec/specs/capture-config-metadata/spec.md covering the internal engine result; it needs extending to cover the JSON envelope

/opsx:ff

Files to read:
- engine/bundle.ps1 — `New-CaptureBundle`, `Get-MatchedConfigModulesForApps`, `Invoke-CollectConfigFiles`
- engine/capture.ps1 — `Invoke-Capture` result assembly (near end of function, search for `$result.ConfigCapture` and `$result.BundleResult`)
- engine/config-modules.ps1 — `Get-ConfigModuleCatalog` module schema
- bin/endstate.ps1 — capture command handler, search for the section that builds the JSON envelope for capture (look for `configsIncluded` or `outputFormat` or `BundleResult` in the --json block)
- engine/json-output.ps1 — `New-JsonEnvelope` helper
- openspec/specs/capture-config-metadata/spec.md — existing OpenSpec to extend
- openspec/specs/apply-restore-envelope/spec.md — reference format for envelope OpenSpec
- docs/contracts/cli-json-contract.md — JSON contract reference
- modules/apps/vscode/module.jsonc — sample module structure

/opsx:apply

Task 1: Enrich New-CaptureBundle return value (engine/bundle.ps1)

Add a `ConfigModulesDetail` array to the result hashtable returned by `New-CaptureBundle`. Build it from the `$matchedModules` array that is already available in the function, combined with the `$configResult` from `Invoke-CollectConfigFiles`.

For each matched module, emit:
```
@{
    id = $module.id                                    # e.g. "apps.vscode"
    appId = <strip "apps." prefix from module.id>      # e.g. "vscode"
    displayName = $module.displayName                  # e.g. "Visual Studio Code"
    status = <"captured" | "skipped" | "error">        # from configResult.included/skipped/errors
    filesCaptured = <count of files captured for this module>
}
```

Status logic:
- If module's dirName is in `$configResult.included` → status = "captured"
- If module's dirName is in `$configResult.skipped` → status = "skipped"
- If any error string contains the module's dirName → status = "error"

The `filesCaptured` count: you need to track per-module file counts in `Invoke-CollectConfigFiles`. Currently it only tracks the total `$result.filesCopied`. Add a `moduleFileCounts` hashtable to the result keyed by moduleDirName → count. Then `New-CaptureBundle` can look up the count per module.

Preserve all existing return fields — this is purely additive.

Task 2: Surface configModules in capture JSON envelope (bin/endstate.ps1)

In the capture command's `--json` handler where the envelope `$data` hashtable is built, add a `configModules` field when bundle capture was used:

```powershell
if ($captureResult.BundleResult -and $captureResult.BundleResult.ConfigModulesDetail) {
    $data.configModules = @($captureResult.BundleResult.ConfigModulesDetail)
}
```

The resulting JSON envelope data section should include:
```json
{
  "outputPath": "...",
  "outputFormat": "zip",
  "configsIncluded": ["vscode", "git"],
  "configsSkipped": ["obsidian"],
  "configsCaptureErrors": [],
  "configModules": [
    {
      "id": "apps.vscode",
      "appId": "vscode",
      "displayName": "Visual Studio Code",
      "status": "captured",
      "filesCaptured": 3
    },
    {
      "id": "apps.git",
      "appId": "git",
      "displayName": "Git",
      "status": "captured",
      "filesCaptured": 1
    },
    {
      "id": "apps.obsidian",
      "appId": "obsidian",
      "displayName": "Obsidian",
      "status": "skipped",
      "filesCaptured": 0
    }
  ]
}
```

Keep the existing flat `configsIncluded`/`configsSkipped`/`configsCaptureErrors` fields for backward compatibility. The `configModules` array is additive.

Task 3: Update OpenSpec (openspec/specs/capture-config-metadata/spec.md)

Extend the existing spec to cover the JSON envelope surface. Add these scenarios:

```markdown
#### Scenario: configModules in capture JSON envelope

- **WHEN** `capture --WithConfig --json` produces a bundle with matched config modules
- **THEN** the JSON envelope `data` object contains a `configModules` array
- **AND** each element includes: id (string), appId (string), displayName (string), status (string), filesCaptured (integer)
- **AND** status is one of: "captured", "skipped", "error"

#### Scenario: appId derived from module ID

- **WHEN** a config module with id "apps.vscode" is captured
- **THEN** the configModules entry has appId "vscode"
- **AND** appId is always the module id with "apps." prefix stripped

#### Scenario: configModules absent when no config capture

- **WHEN** `capture --json` is run WITHOUT `--WithConfig`
- **THEN** the JSON envelope `data` does NOT contain a `configModules` field

#### Scenario: configModules includes all matched modules regardless of status

- **WHEN** capture matches 3 modules but only 2 have files on disk
- **THEN** configModules contains 3 entries
- **AND** 2 have status "captured" and 1 has status "skipped"
```

Task 4: Add unit tests

Add Pester tests for the enriched `New-CaptureBundle` result in the appropriate test file. Test:
- `ConfigModulesDetail` is present in result when modules are matched
- Each entry has required fields: id, appId, displayName, status, filesCaptured
- appId correctly strips "apps." prefix
- Status correctly maps from included/skipped lists
- filesCaptured counts are accurate per module
- `ConfigModulesDetail` is empty array (not null) when no modules matched

/opsx:verify

1. Run unit tests: .\scripts\test-unit.ps1
2. Verify the new fields exist in the bundle result by checking test output
3. Confirm OpenSpec validation: npm run openspec:validate

/opsx:archive

Commit message: "feat: surface structured configModules metadata in capture JSON envelope"
