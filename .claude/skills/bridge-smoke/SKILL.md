---
name: bridge-smoke
description: Drive a real-engine smoke test against the running browser-bridge (npm run tauri:dev:browser + chrome-devtools MCP). Use when verifying hosted-backup flows end-to-end against the actual engine, NOT against mocks.
---

Run a parameterised smoke against the live engine via the dev HTTP bridge.
All `invoke` / `listen` calls go over HTTP to the real bundled engine — no
mocks, no fixtures. Use this when "the wiring test passes but does it work
in the real app?" matters.

**Input**: short description of what to verify. Example:
`/bridge-smoke click Subscribe on the Backup pane and confirm a real Paddle checkoutUrl opens`

**Pre-flight (always)**

1. **Check sibling engine version.** The bridge speaks to whatever
   `endstate.exe` is bundled in `src-tauri/binaries/`. If the test needs a
   command introduced in a recent release, ensure the sibling repo is at
   that tag and the binary is rebuilt:
   ```
   git -C ../endstate fetch --tags
   git -C ../endstate checkout v<X.Y.Z>
   rm -f src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe   # force rebuild
   node scripts/rebuild-engine.cjs
   ```
   Verify the binary has the subcommand you need:
   `./src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe <cmd> --help`
2. **Direct envelope check (cheap, fast, no Tauri).** Invoke the real
   command directly first to learn the envelope shape:
   `./src-tauri/binaries/endstate-x86_64-pc-windows-msvc.exe backup subscribe --json`
   Treat the bytes you see as ground truth — your assertions match these.

**Launch the bridge**

3. Run `SKIP_ENGINE_BUILD=1 npm run tauri:dev:browser` in the background.
   This starts Vite (1420) + the Tauri binary, which boots an HTTP server
   on 9876 (debug build + `--features dev-server` + `ENDSTATE_BROWSER_BRIDGE=1`).
4. **Arm a single-shot watcher** that emits when either the success or
   failure signal lands — silence after a crash will fool you:
   ```bash
   until grep -qE "Browser bridge listening|STATUS_|error\[|terminated with" /tmp/tauri-dev-browser.log; do
     sleep 2
   done
   ```
   Run that in `run_in_background:true` with a 5-minute timeout.

**KNOWN HAZARD — Tauri dev-server crash on this Windows box.** See
`memory/project_tauri_dev_server_crash.md`. The Tauri main process can
heap-corrupt or hit STATUS_ILLEGAL_INSTRUCTION within ~3s of `Browser bridge
listening`. The bridge dies with it. Survival window is roughly enough for a
few `curl` round-trips but **flaky for interactive Chrome drives**. If the
log shows `STATUS_HEAP_CORRUPTION` or `STATUS_ILLEGAL_INSTRUCTION`:
- Don't keep retrying blindly — three consecutive crashes happened in one
  session before. The crash is reproducible, not transient.
- For envelope-shape verification, **curl is enough** (see step 6).
- For UI clicks, fall back to the wiring e2e
  (`e2e/backup-subscribe.spec.ts` pattern) and report the crash as the
  remaining gap rather than fighting it.

**Curl round-trip (always do this — it's the load-bearing check)**

5. Verify the bridge accepts an invoke:
   ```bash
   curl -sS -X POST http://127.0.0.1:9876/api/invoke \
     -H 'Content-Type: application/json' \
     -d '{"cmd":"engine_is_running","args":{}}'
   ```
   Expect `{"ok":true,"data":false}`.
6. Round-trip the actual engine command. The dispatch goes through the
   `endstate_exec` Tauri command — `exe` is `__bundled__` in bundled mode,
   `args` are the engine subcommand flags. The response embeds the engine
   envelope in `data.stdout` as a JSON string:
   ```bash
   curl -sS -X POST http://127.0.0.1:9876/api/invoke \
     -H 'Content-Type: application/json' \
     -d '{"cmd":"endstate_exec","args":{"exe":"__bundled__","args":["backup","--json","subscribe"]}}' \
     | python -c "import sys,json; print(json.dumps(json.loads(json.load(sys.stdin)['data']['stdout']), indent=2))"
   ```
   Compare the envelope to step 2's ground-truth bytes — they should match.

**Drive Chrome MCP (only if the bridge is still alive)**

7. Open the GUI in a real Chromium tab (separate from the Tauri webview):
   ```
   mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page(url="http://127.0.0.1:1420")
   ```
8. Wait for first-paint signal, then navigate to the target pane. The
   sidebar is hidden on landing/save/setup (intent pages), so use the
   command palette:
   ```
   press_key("Control+k")
   wait_for(["Go to Backup"])
   click(<uid>)
   wait_for_testid("backup-pane")
   ```
9. Take a snapshot (not screenshot — a11y snapshot is cheaper and gives
   uids for clicks):
   ```
   take_snapshot()
   ```
10. Click the target affordance, then immediately check
    `list_network_requests` filtered to `:9876` — that's proof the click
    triggered a real bridge round-trip:
    ```
    list_network_requests({resourceTypes: ["fetch"]})
    ```
    Look for POST to `http://127.0.0.1:9876/api/invoke`.
11. Capture final state via screenshot for the report:
    ```
    take_screenshot({filePath: ".claude/scratch/bridge-smoke-<step>.png", fullPage: true})
    ```

**Teardown**

12. Stop the background `tauri:dev:browser` task with `TaskStop` (or its
    natural crash will reap it).
13. If the sibling engine was checked out to a specific tag for this run,
    note the original branch so the user can switch back:
    `git -C ../endstate switch <previous-branch>`.

**Report**

End with a tight summary:
- What was verified (bridge round-trip; envelope shape; click triggered
  network POST to 9876; final DOM state)
- What was *not* verified, with the reason (e.g. "Tauri host crashed before
  click — see memory/project_tauri_dev_server_crash.md")
- Screenshot paths

**Anti-patterns**

- Don't mock anything. This skill exists *because* the wiring e2e already
  covers mocks. If your assertions need mocks, write a Playwright spec
  instead.
- Don't open the Tauri webview window and drive *that* — chrome-devtools
  MCP can't attach to WebView2. Drive a separate Chromium against the same
  Vite URL; both webviews talk to the same bridge.
- Don't loop-retry on Tauri crashes. The crash mode is reproducible —
  retrying just wastes wall-clock and context. Report the gap.
- Don't `cd` in Bash on this Windows box — PowerShell cwd resets fight it.
  Use absolute paths with `git -C` / `yadm -C` style flags.
