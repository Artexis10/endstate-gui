# Endstate GUI - Development Notes

## Architecture

The GUI is a **dumb renderer** that spawns endstate CLI and parses JSON from STDOUT. All business logic lives in endstate.

## Commands Invoked

The GUI runs these endstate commands with `--json` flag:

1. **`endstate capabilities --json`** - Startup probe to check engine availability
2. **`endstate report --json`** - Get history/state information
3. **`endstate verify --manifest <path> --json`** - Check machine status ("Check setup" button)
4. **`endstate apply --manifest <path> --json [--dry-run]`** - Apply configuration ("Set up my machine" button)

### Execution Modes

**Mode 1: PATH (preferred)**
- Command: `endstate <command> --json <args>`
- Requires endstate to be on system PATH

**Mode 2: Script Path**
- Command: `pwsh -NoProfile -ExecutionPolicy Bypass -File <script.ps1> <command> --json <args>`
- Uses absolute path to endstate.ps1
- Default: `C:\Users\<user>\Desktop\projects\endstate\endstate.ps1`

## STDOUT Parsing Contract

- GUI expects **pure JSON** on STDOUT
- If STDOUT is not valid JSON, GUI shows blocking error state
- All commands return `EndstateEnvelope<T>` structure:
  ```typescript
  {
    schemaVersion: string;
    cliVersion: string;
    command: string;
    runId: string;
    timestampUtc: string;
    success: boolean;
    data: T;
    error: EndstateError | null;
  }
  ```

## Error Handling

- **Blocking error screen** shown when:
  - endstate CLI cannot be spawned
  - STDOUT is not valid JSON
  - capabilities command fails
- Error screen displays:
  - Error message
  - STDERR output
  - Command attempted
  - Retry button

## UI Structure

### Home/Overview Screen

Three cards:
1. **Endstate engine** - CLI version, schema version, status
2. **Machine status** - Results from verify (ok/missing/mismatch counts)
3. **Last run / history** - Last applied/verify timestamps

### Actions Panel

- Profile input field
- Three buttons:
  - **"Set up my machine"** (primary) - runs apply
  - **"Check setup"** (secondary) - runs verify
  - **"Refresh"** (tertiary) - re-runs report + verify
- Last action timestamp display

### JSON Details

Each card has expandable "View details (JSON)" section showing raw envelope.

## Settings Storage

Settings are persisted in **localStorage** under key `endstate-gui-settings`:

```typescript
{
  engineMode: 'path' | 'script',
  engineScriptPath: string,
  manifestDirectory: string,
  lastSelectedProfile: string,
  dryRunEnabled: boolean  // Default: true
}
```

## Manifest Discovery

- User configures a manifest directory in Settings
- GUI scans directory for `*.json`, `*.jsonc`, `*.json5` files
- Profile names extracted from filenames (e.g., `My-Laptop.jsonc` → "My-Laptop")
- Dropdown populated with discovered profiles
- Last selected profile persisted in localStorage

## Safe-by-Default Apply

- **Dry run checkbox** enabled by default
- When enabled: `apply --manifest <path> --dry-run`
- When disabled: `apply --manifest <path>`
- User must explicitly disable to make real changes
- This is NOT business logic—just flag passing

## Streaming Logs

- All commands run with streaming output
- Live logs displayed in "Run Output" panel
- Shows stderr and non-JSON stdout in real-time
- After process exits, stdout parsed as JSON envelope
- Logs cleared on each new run

## Auto-Refresh Behavior

**On startup:**
- Run `capabilities --json`
- Run `report --json`
- If profile selected: run `verify --manifest <path> --json`

**After "Check setup":**
- Auto-refresh `report --json`

**After "Set up my machine":**
- Auto-refresh `report --json`
- Auto-refresh `verify --manifest <path> --json`

## Files Changed

**Created:**
- `src/settings.ts` - Settings management with localStorage persistence
- `src/file-discovery.ts` - Manifest discovery (calls Tauri backend)
- `src/streaming-runner.ts` - Streaming execution with live event handling

**Modified:**
- `src/types.ts` - TypeScript types for endstate envelopes
- `src/App.tsx` - Complete UI with settings modal, profile dropdown, streaming logs, recovery controls, preflight validation
- `src/App.css` - Styling for all components including validation states and error actions
- `src-tauri/src/lib.rs` - Added `list_manifest_files`, `run_endstate_streaming`, and `check_file_exists` commands

## User-Facing Language

Internal commands are reframed for users:
- ❌ "verify" → ✅ "Check setup"
- ❌ "apply" → ✅ "Set up my machine"
- ❌ "report" → ✅ "History"

Technical details remain accessible via expandable JSON sections.

## Demo Flow

1. **First Launch:** Welcome screen prompts user to open Settings
2. **Settings:** User configures engine mode and manifest directory
3. **Profile Selection:** Dropdown auto-populated with discovered manifests
4. **Check Setup:** User clicks "Check setup" → sees live logs → sees results in cards
5. **Set Up Machine:** User clicks "Set up my machine" (dry run by default) → sees live logs → sees updated status
6. **Auto-Refresh:** Report and verify automatically refresh after actions

## Error Handling

- **No manifests found:** Inline hint with link to Settings
- **Engine unreachable:** Blocking error screen with stderr, command, and recovery controls
- **Invalid JSON stdout:** Treated as engine unreachable
- **Profile not selected:** Alert prompts user to select profile

## Recovery Controls

**Blocking Error Screen** provides three recovery options:

1. **Open Settings** - Opens settings modal to reconfigure engine
2. **Reset Settings** - Clears localStorage key `endstate-gui-settings` and reloads with defaults
3. **Retry** - Attempts startup probe again with current settings

**Reset Settings behavior:**
- Removes `endstate-gui-settings` from localStorage
- Reloads default settings (script mode with default path)
- Clears selected profile and discovered profiles
- Immediately runs startup probe (capabilities + report)
- User cannot break the app permanently - one-click recovery always available

## OpenSpec Behavior Specifications

See `openspec/specs/` for formal behavior specifications:

- **`draft-and-profile-state.md`** - Draft capture handling, profile selection persistence, and error semantics (INV-1, INV-2, INV-3)

## Preflight Validation

**Settings modal enforces validation before allowing Save:**

**Script Mode:**
- Validates script path is not empty
- Validates path ends with `.ps1`
- Checks file exists using Tauri `check_file_exists` command
- Shows inline status: "Found" (green) or "File not found" (red)
- Save button disabled until validation passes

**PATH Mode:**
- Runs preflight probe: `endstate capabilities --json`
- Shows inline status: "Found" (green) or "Not found on PATH" (red)
- Save button disabled until probe succeeds

**Result:** Impossible to save broken engine configuration
