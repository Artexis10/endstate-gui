## Tasks

### Task 1: Ldflags version embedding

- [x] 1.1 Read VERSION and SCHEMA_VERSION files from engine repo root (`path.resolve(ENGINE_DIR, '..')`)
- [x] 1.2 Pass ldflags to go build command in rebuild-engine.cjs

### Task 2: Staleness guard

- [x] 2.1 Add staleness guard: git fetch + log comparison, hard error in strict mode
- [x] 2.2 Add staleness warning in lenient mode (non-strict)

### Task 3: VERSION fallback removal

- [x] 3.1 Remove VERSION file fallback from version extraction catch block

### Task 4: Verification

- [x] 4.1 Verify build outputs correct version via capabilities --json
