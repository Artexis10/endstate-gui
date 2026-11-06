# Endstate UX–Engine Contract

This document defines the binding contract between:
- User Experience (GUI)
- Engine behavior
- CLI capabilities

Its purpose is to ensure Endstate remains coherent, inspectable,
and predictable across interfaces.

If GUI and CLI behavior diverge, the system is broken.

---

## Fundamental Rule

Every GUI action must map to:
- a deterministic engine operation
- a reproducible CLI command
- a visible artifact

No exceptions.

---

## Concept: Profile (Setup)

### UX
- A “setup” the user creates and names
- Shown as a tangible item
- Has a clear storage location

### Engine
- Declarative plan file
- Optional hydration bundle
- Explicit restore steps only

### CLI

~~~bash
endstate capture --profile "My Setup"
endstate apply --profile "My Setup"
~~~

---

## Concept: Profile Location

### UX
- Clearly displayed
- Openable
- Copyable path

### Engine
Profiles are stored under:

Documents/Endstate/Profiles

### CLI

~~~bash
endstate profiles list
endstate profiles path "My Setup"
~~~

---

## Concept: “Keep Settings”

### UX
- Per-app toggle
- Disabled by default
- Framed as optional

### Engine
- restore.enabled: true
- Explicit restore steps only
- No implicit capture

### CLI

~~~bash
endstate capture --include-config vscode,git
~~~

No flag means install-only.

---

## Concept: Advanced Mode

### UX
- Optional toggle
- Sticky preference
- Reveals technical details only

### Engine
- No effect
- No behavior change

### CLI
Not applicable.

Advanced Mode reveals information only.  
It never unlocks unsafe behavior.

---

## Concept: Unsupported / Blocked Apps

### UX
- Not offered
- Or shown as “Not supported”

### Engine
- Hard exclusion list
- Validation prevents restore steps

### CLI

~~~bash
endstate validate profile
~~~

Blocked behavior cannot be overridden.

---

## Concept: Re-run Safety

### UX
- Calm messaging
- No warnings for repeat runs

### Engine
- Idempotent operations
- Backup-before-restore
- Deterministic ordering

### CLI

~~~bash
endstate apply --profile "My Setup"
endstate verify --profile "My Setup"
~~~

---

## Error Semantics Contract

Errors occur only when:
- an app installation fails
- an explicit restore step fails
- verification fails

Absence of configuration is not an error.

### Structured verification results

The current engine returns `data.manifest`, `data.summary`, and `data.results`
for `verify`. The GUI retains these fields without converting them into the
older package-only `items`, `okCount`, or `missingCount` fields.

Each result has a `type` and `status`. Other fields are optional and depend on
the result type. A captured configuration result uses `type: "config"` and
identifies the capture with `id`. It can omit package fields such as `driver`
and `version`. Consumers preserve its structured `reason` and `message`.

Configuration verification compares captured content with the current target.
Changed content returns `status: "fail"` with `reason: "config_drift"`.
A missing target with captured content returns `reason: "missing"`. An absent
optional source makes no assertion that the target must be absent. An unchecked
or ambiguous configuration remains skipped; it does not count as a pass.
Unreadable or unstable targets fail with `config_read_failed`. Unsupported content
uses `config_content_unchecked`. Missing or changed listed payload fails with
`payload_integrity_failed`; consumers must not report it as target drift.

A Home Manager result uses `type: "home-manager"`. It checks activation ownership
and the declared files recorded with that activation. Missing file expectations
return `status: "skip"` and `reason: "file_expectations_unavailable"`. Changed
files fail with `config_drift`; missing files fail with `missing`; unreadable
files or history fail with `unreadable`. Matching file hashes do not verify typed
settings. The stream uses `skipped` for unavailable evidence and `failed` for
failed checks. Consumers retain the engine's reason and message.

Home Manager rollback may report `verification: "verified"` or `"unverified"`.
Unavailable evidence adds `verificationReason: "file_expectations_unavailable"`.
Consumers must not treat reactivation alone as content verification.

Generated Home Manager activation requires known native ownership. The engine
observes the generation and exact activation output before package mutation and
again before activation. Only a missing native profile establishes absence.
Unreadable, malformed, incomplete, or changing profiles and unreadable history
leave ownership unknown.

Unknown ownership returns `INPUT_PROVENANCE_UNRESOLVED` with
`error.detail.subcode: "home-ownership"`. Native permission and availability
failures retain their existing error codes. Consumers preserve the engine's
message and do not infer an external owner from an observation failure.

An established external owner receives `homeManager.ownershipAction` with
`owner: "external"`, `action: "import_generated_module"`, `required: true`,
`modulePath`, `message`, and optional `activeGeneration`. The generated
configuration remains inactive; the engine leaves the owner's source graph
unchanged. Consumers present the action without reporting completed activation.

The action's `modulePath` identifies the generated `default.nix` entry. That entry includes the copied configuration, staged file payloads, and optional secret references. Every generation uses a separate persistent directory; later generation preserves earlier imports. Clients keep the engine's exact path and do not reconstruct it from the user name.

The owner chooses its source-graph change and activation. A pure owner flake can expose the generated directory as a non-flake input and import `default.nix` through that input. Generated directories remain on disk because external imports may still use them. The config-file wrapper does not relocate relative imports or other source-graph dependencies.

A late ownership error can follow committed package work. An activation whose
resulting identity cannot be observed reports `stage: "commit"` and
`committed: true`; consumers must not turn this uncertainty into success.
A known process-start failure does not claim that activation ran.
Capture reports unavailable ownership through provenance warnings and retains
independent results. Verification reports unavailable native observation or
history as `unreadable`, native absence as `missing`, and conflicting identity
as `config_drift`.

Output identity can establish ownership across native generations. Capture of an
output-backed declaration needs completion evidence for the observed generation
and output. A newer failure for that output prevents recovery of an older
success. Consumers preserve unavailable-provenance warnings and independent
capture results. An uncertain rollback can invalidate pre-attempt completion
without proving its post-attempt identity.

`summary` reports `total`, `pass`, `fail`, and optional `skipped` counts.
The envelope's `success` reports whether the command produced a valid result.
Verification failures remain in `summary.fail` and the individual results.

---

## Capture Artifact Contract (INV-CAPTURE)

### Linux discovery accounting

Linux capture keeps the complete `data.discovery` inventory under `--only`.
Selected packages and private file plans determine the artifact contents.
Consumers must use `discovery.counts` for candidate totals rather than summing
overlapping source observations or counting only the included apps.

`discovered = resolved + settingsOnly + unresolved`. The `settings` count can
overlap `resolved`; `settingsOnly` counts supported settings without a resolved
package. `selected` counts selected package or capturable settings candidates
once each. Sanitized capture selects packages without collecting settings.
Equal package and settings ID text does not establish an association;
only a reviewed settings `packageId` joins them.

Schema-v1 `discovery-source` events contain the unchanged normalized row in
`source`. `discovery-item` events contain `kind` and its matching `resolved`,
`settings`, or `unresolved` row. They preserve the complete public inventory,
including unselected rows, and do not establish capture success.

Source `discovered` and `ignored` count accepted observations. Display source
state instead of inventory counts for `failed` or `not_available` reads.
All-failed and managed-profile fallback totals describe incomplete coverage.
Keep typed `diagnostic` facts in technical details; show the engine's product
message first. `retries` counts extra source-specific fallback queries, not
process starts. The final envelope remains the authority for the saved artifact.

Schema-v3 Linux generations can also capture one declared desktop value through
the existing configuration workflow. A `desktop` detector supplies evidence with
`type: "desktop"`, `backend: "gsettings"`, and `platform: "linux"`.
`capture.desktopValues` contains trusted target/destination declarations;
`desktop-value` restores use a trusted target and a desired-state payload.
Boolean payloads distinguish inherited absence from explicit `false`.
Effective defaults and private runtime scope stay outside portable evidence.

The existing `config-resolution`, `restore-item`, and `config-migration` events
carry this workflow. A restore item uses `restorer: "desktop-value"` and the
case-sensitive `gsettings:<backing-directory><key>` target identity. Consumers
render the engine's result and preserve the existing restore consent.
Native desktop detection remains unavailable until its separate acceptance
passes; injected workflow proof does not advertise GNOME support.

Selected Linux capture scopes historical Home Manager declarations through the
registry's program, package, and module associations. Retained update apps do
not widen settings scope. Historical source paths do not authorize collection;
portable file references come from authorized staged payloads. Sanitization
omits the entire Home Manager block. Sharing omits historical inline material
that its payload redaction pipeline cannot process.

Unrestricted private capture can retain opaque config or flake references and
withhold competing live settings. Selected capture omits opaque references
that it cannot scope. The engine reports these omissions in structured warnings;
the GUI must not claim that omitted settings were captured.

### Invariants

1. **Success implies artifact exists and is valid.**
   If capture returns `success:true`, then `outputPath` MUST exist and contain a valid manifest payload (not `{}`).

2. **CLI missing is a hard failure.**
   If the provisioning CLI entrypoint is missing, capture MUST return `success:false` with structured error code `ENGINE_CLI_NOT_FOUND`.

3. **No artifact on failure.**
   If capture fails, no manifest artifact is emitted and no `outputPath` is claimed.

### Failure Mode Table

| Error Code | Cause | GUI Behavior |
|------------|-------|--------------|
| `ENGINE_CLI_NOT_FOUND` | Provisioning CLI not found at configured path | Show actionable toast: use `error.hint` if present, else "Engine CLI not found. Configure Engine path in Settings." |
| `MANIFEST_WRITE_FAILED` | Capture succeeded but file write failed | Show `error.message` verbatim |
| `CAPTURE_FAILED` | Generic capture failure | Show `error.message` verbatim |
| (no error code) | Unknown failure | Show "Capture failed" |

### GUI Enforcement

- GUI MUST NOT persist draft content if capture returned `success:false`
- GUI MUST NOT persist draft content if manifest payload is empty (`{}`)
- GUI MUST surface `ENGINE_CLI_NOT_FOUND` with actionable hint mentioning Settings

### CLI Path Resolution

Engine script path resolution order (for script mode):
1. User-configured path (if exists)
2. `<repoRoot>\bin\endstate.ps1` (preferred)
3. `<repoRoot>\bin\endstate.cmd` (fallback)
4. Legacy `<repoRoot>\endstate.ps1` (migration only)

---

## Scheduled setup checks

`features.schedule.supported` describes manual schedule operations on Windows
and Linux. Native registration has separate availability in
`features.schedule.registration`, with `supported`, optional `backend`, `reason`,
and `detail`. An absent registration capability means unknown availability.

`schedule status` retains saved intent, queue state, and last-run truth when
native inspection fails. Its additive `registration` object reports observed
availability and independent `stateReason`/`stateDetail`. Missing native
`enabled`, `active`, or `nextTriggerUtc` fields mean unknown. Saved `enabled`
alone does not prove that a task or timer is registered or healthy.

The registration object can contain `units`, keyed by unit name. Each observed
unit has a path and optional presence, ownership, integrity, SHA256, fragment
path, and drop-in paths. Native service result, active state, and exit status
remain separate from the persisted run result. `lastRunError` with code
`LAST_RUN_READ_FAILED` identifies an unreadable result; absent `lastRun` alone
does not establish that the schedule never ran.

Windows uses Task Scheduler. Linux registration requires an existing systemd
user manager and usable unit directory; it never starts a bus, changes system
units, or enables lingering. Manual run, upload replay, and discard remain
independent of native registration. Saved enabled intent still governs runs.
The native arguments are `schedule run --root R --json`; nested operations use
that root and read the current saved manifest. Linux catch-up waits for the
registration commit. Status performs no recovery writes.

The engine preserves benign inherited policy. Concrete execution or cadence
overrides report `REGISTRATION_OVERRIDDEN`; ownership conflicts preserve foreign
or modified units. Registration failures identify their phase and reason.
Systemd rejects quotes, backslashes, and control characters in executable
paths before any configuration change. Native lifecycle, rendered GUI,
packaged application, and release acceptance remain separate obligations.

---

## Contract Violations (Considered Bugs)

The following are bugs:
- GUI-only behavior
- Silent configuration restore
- Profiles stored outside Documents
- Hidden state not representable via CLI
- Advanced mode changing behavior

---

## Final Intent

Endstate is a transparent system.

Users should always be able to:
- understand what will happen
- predict outcomes
- inspect artifacts
- reproduce behavior

The GUI explains.  
The engine executes.  
The CLI guarantees truth.
