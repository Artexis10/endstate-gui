# Fake engine (real-spawn fault injection)

`fake-engine.cjs` is a dependency-free Node script that impersonates
`endstate <cmd> --json` well enough to drive the GUI's **real** spawn path
(`src/streaming-runner.ts` + the Rust adapter) without the nondeterminism of
forcing a real engine to crash.

## Modes

Selected via the `FAKE_ENGINE_MODE` environment variable:

| Mode | stdout | stderr | exit | Terminal envelope? |
|------|--------|--------|------|--------------------|
| `crash-mid-run` | phase + item events, then stops | `panic: …` | `1` | **No** |
| `malformed-line` | valid item, one truncated line, valid item, envelope | log noise | `0` | Yes (recovers) |
| `hang-then-exit` | item, pause (`FAKE_ENGINE_HANG_MS`, default `50`), stop | log noise | `0` | **No** |
| `garbage` | non-UTF8 / broken-JSON bytes | garbage bytes | `1` | **No** |
| _(unset/other)_ | healthy events + envelope | log noise | `0` | Yes |

Other env knobs: `FAKE_ENGINE_RUN_ID`, `FAKE_ENGINE_TIMESTAMP`,
`FAKE_ENGINE_HANG_MS`.

## Test it

```
node --test tests/fake-engine/fake-engine.test.mjs
```

This is a standalone `node:test` contract test for the fake itself. It is **not**
wired into `npm run test:contract` (that runs `tests/contract.test.js`, which is
owned by a different lane) and is intentionally kept separate.

## L3 CI lane (forthcoming)

The forthcoming **gui-real-engine** CI lane (L3) will point the standalone dev
bridge at this script via an engine-path override (e.g. an `endstate`-named
shim or a bridge `--engine-path` flag) and run the existing e2e assertions
against the real spawn/stderr/exit path. That closes the loop the mocked e2e
lane cannot reach: proving that a crashed, hung, or garbage-emitting process is
never rendered as success once the bytes travel through the real process
boundary.
