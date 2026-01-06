# Manual Verification Checklist for NDJSON Event Streaming

## Prerequisites
- Endstate CLI installed and available (either in PATH or as script)
- GUI configured with valid engine path in Settings

## Test 1: Capture with Live Progress

**Steps:**
1. Launch the Endstate GUI
2. Navigate to Capture page
3. Click "Capture Current Setup"
4. **Observe during execution:**
   - Live progress messages appear showing individual apps being detected
   - Messages should show format: "Detected: App.Name" or similar
   - Progress updates incrementally as capture runs
   - No need to wait for completion to see updates

**Expected Behavior:**
- UI shows live item-by-item progress (not just a spinner)
- Each detected app appears in real-time
- On completion, shows total count and manifest path
- "Technical Details" section shows raw logs if expanded

**What This Proves:**
- Capture passes `--events jsonl` to CLI
- Stderr NDJSON events are parsed and dispatched to UI
- Item events update UI state incrementally
- Artifact event captures manifest path

## Test 2: Apply Preview with Phase Transitions

**Steps:**
1. Select a profile from the dropdown
2. Click "Preview Changes" (or equivalent dry-run button)
3. **Observe during execution:**
   - Live progress shows apps being analyzed
   - Status messages like "To install: App.Name" or "Already present: App.Name"
   - Progress updates as each app is checked

**Expected Behavior:**
- UI shows live progress during preview
- Different statuses displayed (to_install, already_present, skipped)
- Preview modal shows structured results after completion
- Items grouped by status in modal

**What This Proves:**
- Apply (dry-run) passes `--events jsonl` to CLI
- Phase event sets current phase
- Item events update per-item status
- Summary event finalizes counts

## Test 3: Apply with Multi-Phase Progress

**Steps:**
1. Select a profile with at least one app to install
2. Click "Apply Changes" (actual installation)
3. **Observe during execution:**
   - Live progress shows installation status
   - Messages like "Installing: App.Name" appear during install
   - After install phase, may show verify phase messages
   - Progress updates continuously

**Expected Behavior:**
- UI shows live installation progress
- Status transitions visible (installing → installed)
- If verify phase runs, shows verification messages
- Final modal shows success/failure with counts

**What This Proves:**
- Apply (actual) passes `--events jsonl` to CLI
- Multi-phase support (plan → apply → verify)
- Item status updates as installations progress
- Summary event marks completion

## Test 4: Verify Chunked Stderr Handling

**Steps:**
1. Run any operation (capture/apply/verify)
2. Open browser DevTools Console (F12)
3. Look for `[SPAWN START]` and `[SPAWN END]` debug logs (dev mode only)
4. Check for any errors about JSON parsing

**Expected Behavior:**
- No JSON parse errors in console
- NDJSON events processed successfully even if split across chunks
- All events accounted for in final UI state

**What This Proves:**
- StreamingEventBuffer correctly buffers partial lines
- Windows CRLF handling works
- No crashes on chunked data

## Test 5: Mixed Stderr Content

**Steps:**
1. Run capture or apply
2. Expand "Technical Details" section
3. **Observe:**
   - Raw logs visible in technical details
   - Both NDJSON events and plain text logs present
   - No parsing errors

**Expected Behavior:**
- Technical details show all stderr output (NDJSON + plain text)
- UI doesn't crash on non-JSON stderr lines
- Live progress still works despite mixed content

**What This Proves:**
- Non-JSON stderr lines don't break NDJSON parsing
- Parser gracefully ignores invalid JSON
- Raw stderr preserved for debugging

## Verification Summary

After completing all tests, confirm:
- ✅ Live progress works for Capture
- ✅ Live progress works for Apply (preview)
- ✅ Live progress works for Apply (actual)
- ✅ No console errors during operations
- ✅ Technical details show raw logs
- ✅ Final results match live progress

## Troubleshooting

**If live progress doesn't appear:**
- Check that Endstate CLI supports `--events jsonl` flag
- Verify engine mode is configured correctly in Settings
- Check browser console for errors
- Ensure you're using latest Endstate CLI version

**If you see JSON parse errors:**
- Report as bug - should never happen
- Check if CLI is emitting malformed NDJSON
- Verify Windows line endings are handled

**If progress is delayed:**
- This is normal - events arrive as CLI emits them
- Some operations may have natural pauses
- Check that CLI is actually running (not hung)
