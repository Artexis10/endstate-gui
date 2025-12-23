# Autosuite GUI - Testing Strategy

## Overview

The GUI test suite validates that the application remains "dumb" - it only discovers files, spawns autosuite, parses JSON, and renders. No business logic is implemented in the GUI.

## Quick Start

```bash
# Run unit tests
npm test

# Run unit tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run all tests
npm test && npm run test:e2e
```

## Test Layers

### 1. Unit Tests (Vitest)

**Command:** `npm run test:unit` or `npm test`
**Coverage:** `npm run test:coverage`

**Coverage:**
- **settings.ts** - localStorage persistence, defaults, merging
- **file-discovery.ts** - filename-to-profile mapping, extension stripping
- **streaming-runner.ts** - JSON parsing (valid/invalid), stderr handling, execution modes

**Characteristics:**
- Fast (< 2 seconds)
- No network, no filesystem, no external dependencies
- Mocked Tauri APIs
- Deterministic

**What it validates:**
- Settings are correctly persisted to localStorage
- Default settings are applied when localStorage is empty
- Profile discovery correctly maps filenames to profile names
- JSON envelopes are parsed correctly from stdout
- Invalid JSON is handled gracefully (returns null envelope)
- Both PATH and script execution modes construct correct commands

### 2. Contract Integration Tests (Node.js)

**Command:** `npm run test:contract`

**Coverage:**
- `autosuite capabilities --json` - validates envelope structure
- `autosuite report --json` - validates envelope structure
- `autosuite verify --profile Missing --json` - validates error handling
- `autosuite apply --profile Missing --dry-run --json` - validates error handling

**Characteristics:**
- Spawns real autosuite CLI using same method as GUI (pwsh -File)
- Captures stdout/stderr
- Validates JSON envelope structure
- Skips gracefully if autosuite not found at expected path
- No state changes (uses Missing profile or dry-run)

**What it validates:**
- Autosuite CLI is accessible and executable
- All commands return valid JSON envelopes on stdout
- Envelope structure matches contract (schemaVersion, cliVersion, command, success, data, error)
- Error envelopes contain structured error objects
- GUI's execution model (pwsh -NoProfile -ExecutionPolicy Bypass -File) works correctly

### 3. E2E Smoke Test (Playwright)

**Command:** `npm run test:e2e`

**Coverage:**
- Launch Tauri app
- Open settings modal
- Configure manifest directory (temp folder with dummy manifest)
- Select profile from dropdown
- Click "Check setup"
- Verify machine status card updates

**Characteristics:**
- Full application stack (Rust + React + Tauri)
- Real UI interactions
- Creates temp manifest file for testing
- Cleans up after itself
- Single happy-path flow (5-8 assertions)

**What it validates:**
- App launches successfully
- Settings modal opens and saves
- Manifest discovery populates dropdown
- Profile selection works
- "Check setup" button triggers verify command
- Machine status card displays results
- End-to-end flow from settings → profile selection → action → result display

## Running Tests

```bash
# All unit tests
npm test
npm run test:unit

# Contract integration tests (requires autosuite)
npm run test:contract

# E2E smoke test (requires built Tauri app)
npm run test:e2e

# Run all tests
npm test && npm run test:contract && npm run test:e2e
```

## Test Philosophy

1. **GUI stays dumb** - Tests validate the GUI doesn't implement business logic
2. **Autosuite is the authority** - Contract tests treat autosuite as black box
3. **Deterministic** - No flaky timing, no network calls, no random data
4. **Fast feedback** - Unit tests run in < 2 seconds
5. **Minimal E2E** - E2E tests cover critical user flows and contracts

### Modal Contract Philosophy

UI/UX contracts (modals, toggles, persistence, navigation) are enforced by tests to prevent regressions:

**Core Principles:**
- **Transient state must reset** - Modal state (like technical details expansion) must not persist between opens
- **localStorage pollution cannot affect UI** - Even if localStorage has stale data, UI must start in correct default state
- **User interactions must be reliable** - Toggle, escape, reopen behaviors must work consistently
- **Any UI/UX bug that reaches production must result in a new test**

**Example: Technical Details Collapse**
- Technical details in result modals MUST start collapsed on open
- User can expand/collapse via toggle button
- Closing modal resets transient state
- Reopening modal starts collapsed again (even if localStorage has "expanded=true")
- Escape key closes modal
- No persistence of technical details toggle state

This philosophy ensures the UI remains predictable and prevents recurring regressions.

## What Tests DON'T Cover

- Autosuite business logic (tested in autosuite repo)
- Complex UI interactions (not needed for dumb renderer)
- Error recovery flows (validated by contract tests)
- Performance/load testing
- Cross-platform compatibility (assumed from Tauri)

## Test Maintenance

- **Unit tests** - Update when helper functions change
- **Contract tests** - Update if JSON envelope contract changes
- **E2E test** - Update if core UI flow changes (settings → profile → action)

## Coverage Thresholds

Coverage is tracked to catch regressions early without blocking progress.

**Current Thresholds (Gentle Minimums):**
- Lines: 15%
- Functions: 10%
- Branches: 10%
- Statements: 15%

**Ratcheting Strategy:**
- Thresholds are reviewed and increased **weekly** as coverage improves
- Never decrease thresholds (only increase)
- Increases are small and achievable (5-10% increments)
- Goal: Gradual improvement without blocking development

**Coverage Reports:**
```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html  # macOS
start coverage/index.html # Windows
xdg-open coverage/index.html # Linux
```

Coverage reports show:
- Which files are tested
- Which lines/branches are covered
- Which code paths need tests

## CI/CD Considerations

**GitHub Actions CI runs:**
1. Unit tests with coverage (`npm run test:coverage`)
2. E2E tests (`npm run test:e2e`)
3. Uploads coverage to Codecov
4. Uploads Playwright artifacts (traces/screenshots) on E2E failure

**Local verification before commit:**
```bash
npm test && npm run test:e2e
```

**Fast CI check:**
```bash
npm run test:unit
```
