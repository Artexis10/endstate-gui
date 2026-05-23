---
name: livewire
description: Drive the real GUI against the real engine via the dev HTTP bridge (`npm run tauri:dev:browser`). Use whenever "does the wiring test actually hold up against real code?" matters — smoke verification, UI development with live engine state, real-engine bug repro, exploratory debugging with Chrome DevTools instruments.
---

Real Chromium ↔ real HTTP bridge ↔ real engine. No mocks, no fixtures. The
GUI runs in a regular Chrome tab; every `invoke()` / `listen()` goes over
the bridge to the bundled `endstate.exe` binary. The same DevTools you'd
use on a webapp (network panel, console, evaluate, snapshots) work on the
real production code path.

**Input**: short description of what to do. Examples:
- `/livewire smoke the backup subscribe flow`
- `/livewire drive setup with dry-run and confirm no UAC fires`
- `/livewire hot-iterate on the subscription banner — change copy, see it live`

**Modes (pick before driving)**

- **Smoke** — verify a flow works end-to-end against the real engine.
  Order: curl envelope checks first (cheap, proves protocol), then UI
  drive. Section *Smoke* below.
- **Dev** — iterate on the GUI with the real engine wired up. Vite HMR
  hot-reloads frontend changes; the bridge persists. Section *Dev* below.
- **Debug** — reproduce a real-engine bug. Drive to the failure, inspect
  state via evaluate, scrub network/console panels. Section *Debug*
  below.

All three share the same launch + watcher + hazard handling.

---

## Pre-flight (always)

1. **Check sibling engine version.** The bridge speaks to whatever
   `endstate.exe` is bundled in `src-tauri/binaries/`. If a recent engine
   command is needed, pull the sibling and force a rebuild:
   ```
   git -C ../endstate fetch --tags
   git -C ../endstate checkout v<X.Y.Z>
   rm -f src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe
   node scripts/rebuild-engine.cjs
   ```
   Verify the binary has what you need:
   `./src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe <cmd> --help`
2. **Direct envelope check** (smoke mode only — cheap ground truth, no
   Tauri): `./src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe backup subscribe --json`
   Treat those bytes as the assertion target.

## Launch the bridge

3. **Clear orphan listeners on 1420 + 9876 first.** Earlier crashed runs
   often leave Vite still listening on 1420 (npm doesn't reap it) or
   stranded sockets on 9876. Without this check, the launch fails
   silently: Vite errors with "Port 1420 is already in use" and exits
   via `beforeDevCommand`, OR the Tauri bridge fails to bind and keeps
   running without it (no crash signal, no success signal — watcher
   waits forever).
   ```bash
   for P in $(netstat -ano | grep "LISTENING" | grep -E ":(1420|9876) " | awk '{print $NF}' | sort -u); do
     taskkill //F //PID "$P" 2>/dev/null || true
   done
   sleep 1
   netstat -ano | grep "LISTENING" | grep -E ":(1420|9876) " || echo "ports clear"
   ```
   The `awk '{print $NF}'` is load-bearing — `$5` is `LISTENING`, not the
   PID. On Git Bash, `//F //PID` (double-slash) prevents Msys from
   mangling the args into paths.
4. Run `SKIP_ENGINE_BUILD=1 npm run tauri:dev:browser` in the background.
   This starts Vite (1420) + the Tauri binary, which boots an HTTP
   server on 9876 (debug build + `--features dev-server` +
   `ENDSTATE_BROWSER_BRIDGE=1`).
5. **Arm a single-shot watcher** that emits when ANY of these signals
   land:
   ```bash
   until grep -qE "Browser bridge listening|Browser bridge failed to bind|STATUS_|error\[|terminated with" /tmp/tauri-dev-browser.log; do
     sleep 2
   done
   ```
   Run that in `run_in_background:true` with a 5-minute timeout. The
   bind-failure literal is `Browser bridge failed to bind port 9876` —
   match the prefix so it works across OS-error wording.

**KNOWN HAZARD — Tauri dev-server is intermittently unstable on this
Windows box.** See `memory/project_tauri_dev_server_crash.md`. The Tauri
main process *sometimes* survives a full Playwright drive (150+ bridge
invokes, observed 2026-05-23) and *sometimes* heap-corrupts or hits
STATUS_ILLEGAL_INSTRUCTION within ~3s of `Browser bridge listening`.

Response policy:
- **Restart once.** A clean retry often boots into a stable session.
  Don't retry more than that — the pattern is intermittent, not
  transient.
- **In smoke mode**, curl is enough for envelope-shape verification. Do
  the curl pass first so you have protocol proof regardless of whether
  the UI drive lands.
- **In dev mode**, if the bridge dies mid-iteration, your changes are
  fine — just relaunch (no state was lost). The keychain / engine
  state persists.
- **If the second restart also crashes**, fall back to the mocked e2e
  pattern (`e2e/backup-subscribe.spec.ts`) for the UI assertion and
  report the crash as the remaining gap.

## Tool choice — chrome-devtools MCP is primary

First check `ToolSearch` with `+chrome devtools` to see if the
`mcp__plugin_chrome-devtools-mcp_*` tools are loaded. Use them by default
(real DevTools artifacts: `list_network_requests` for the network panel,
`list_console_messages` for console, `take_snapshot` for uid-based a11y
trees, `evaluate_script` for arbitrary JS, `get_network_request` for
request/response bodies). If chrome-devtools isn't connected this
session, use `mcp__plugin_playwright_playwright__*` as fallback and note
that in the report. Don't mix the two in one session. (See
[feedback-chrome-devtools-over-playwright].)

## Open the GUI in Chromium (separate from Tauri's webview)

6. ```
   mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page(url="http://127.0.0.1:1420")
   ```
   Don't drive the Tauri webview window itself — chrome-devtools MCP
   can't attach to WebView2. Both webviews talk to the same bridge, so
   a separate Chromium is fine and gives you full DevTools access.

---

## Smoke mode

The verification flow. Order matters — curl first, drive after.

7. **Curl `engine_is_running`** through the bridge:
   ```bash
   curl -sS -X POST http://127.0.0.1:9876/api/invoke \
     -H 'Content-Type: application/json' \
     -d '{"cmd":"engine_is_running","args":{}}'
   ```
   Expect `{"ok":true,"data":false}`.
8. **Curl the engine command** itself. Dispatch goes through `endstate_exec`
   — `exe` is `__bundled__` in bundled mode, `args` are the engine
   subcommand flags. The response embeds the engine envelope in
   `data.stdout` as a JSON string:
   ```bash
   curl -sS -X POST http://127.0.0.1:9876/api/invoke \
     -H 'Content-Type: application/json' \
     -d '{"cmd":"endstate_exec","args":{"exe":"__bundled__","args":["backup","--json","subscribe"]}}' \
     | python -c "import sys,json; print(json.dumps(json.loads(json.load(sys.stdin)['data']['stdout']), indent=2))"
   ```
   Compare to step 2's ground-truth bytes — they should match.
9. **Drive Chromium through the flow.** Use the command palette
   (`Ctrl+K → "Go to <pane>"`) — sidebar is hidden on landing/save/setup
   (intent pages). Take a snapshot, click the target, then immediately
   check `list_network_requests({resourceTypes: ["fetch"]})` for the
   POST(s) to `127.0.0.1:9876/api/invoke` — that's proof the click
   round-tripped through the real bridge.
10. **Capture screenshot for the report:**
    ```
    take_screenshot({filePath: ".claude/scratch/livewire-<step>.png", fullPage: false})
    ```

## Dev mode

Hot-iterate on the GUI while everything stays live.

- **Vite HMR is on.** Edit `src/**/*.tsx`, save, and the running Chromium
  tab updates immediately. The bridge connection persists. You can keep
  the Tauri dev process running across many edits.
- **No reload needed for most changes.** If a change does require a full
  reload (route changes, mount-time effects), use
  `navigate_page({type:"reload"})`.
- **Inspect/seed local state with `evaluate_script`**. Examples:
  ```ts
  // Read all endstate-related localStorage
  () => Object.fromEntries(
    Object.entries(localStorage)
      .filter(([k]) => k.includes('endstate'))
      .map(([k, v]) => [k, JSON.parse(v)])
  )

  // Force advanced UI mode
  () => {
    localStorage.setItem('web:endstate-ui-mode', 'advanced');
    localStorage.setItem('web:endstate-sidebar-visible', 'true');
  }

  // Flip dryRunEnabled to test the apply path
  () => {
    const k = 'web:endstate-gui-settings';
    const s = JSON.parse(localStorage.getItem(k));
    s.dryRunEnabled = false;
    localStorage.setItem(k, JSON.stringify(s));
  }
  ```
  Hit `navigate_page({type:"reload"})` after seeding state if the app
  reads settings at mount.
- **Watch the network panel.** `list_network_requests({resourceTypes:
  ["fetch"]})` shows every bridge call as you interact. Filter to
  `9876` mentally; everything else is HMR / asset traffic.
- **Console panel for errors.** `list_console_messages({types:
  ["error", "warn"]})` surfaces React errors, prop-type warnings, etc.,
  the same as opening DevTools in a normal browser.

## Debug mode

When you're reproducing a real-engine bug:

- **Diff direct-invoke vs bridge-invoke.** Step 2 (binary directly)
  and step 8 (binary through bridge) should produce identical
  envelopes. If they don't, the bridge is the culprit (rare).
- **Look at the engine's own debug dump** if the bug involves apply /
  capture / verify. The engine writes per-run logs to
  `C:\Users\<user>\AppData\Local\Endstate\debug\` —
  `ts-parsed-envelope-<cmd>-<ts>.json` has the structured envelope
  including counters and the `dryRun` flag. Useful for confirming the
  CLI received the args you think it did.
- **Use `get_network_request(reqid)`** to inspect a specific bridge
  request body — that's how you confirm a flag like `--dry-run` was
  actually sent (the request body contains the full args array).

## Teardown

11. Stop the background `tauri:dev:browser` task with `TaskStop` (or its
    natural crash will reap it). The kill-orphan command in step 3
    works again if anything sticks.
12. If the sibling engine was checked out to a specific tag, switch it
    back: `git -C ../endstate switch <previous-branch>`.

## Report (smoke mode)

End with a tight summary:
- What was verified (bridge round-trip; envelope shape; click triggered
  network POST(s) to `:9876`; final DOM state; any engine flags
  confirmed via the debug dump)
- What was *not* verified, with the reason (e.g. "Tauri host crashed
  before click — see memory/project_tauri_dev_server_crash.md")
- Screenshot paths

## Anti-patterns

- **Don't mock anything.** This skill exists *because* the wiring e2e
  already covers mocks. If your assertions need mocks, write a
  Playwright spec instead.
- **Don't drive the Tauri webview window.** chrome-devtools MCP can't
  attach to WebView2. Use a separate Chromium against the same Vite URL.
- **Don't loop-retry on Tauri crashes** beyond one restart — the crash
  is intermittent, not transient. Report the gap.
- **Don't `cd` in Bash on this Windows box** — PowerShell cwd resets
  fight it. Use absolute paths with `git -C` / `yadm -C` style flags.
- **Don't conflate dev and smoke.** In dev you're iterating and tolerate
  flakiness; in smoke you're producing a verifiable report. Pick the
  mode up front so the report writes itself.
