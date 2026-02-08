### Requirement: Windows ESM import path conversion
The eval worker SHALL convert Windows absolute paths in dynamic `import()` calls to `file://` URLs before executing evaluated code, so that ESM module resolution succeeds on Windows.

#### Scenario: Import with Windows absolute path succeeds
- **WHEN** evaluated code contains `import('C:\Users\...\module.js')`
- **THEN** the path SHALL be converted to `file:///C:/Users/.../module.js` before execution and the import SHALL succeed

#### Scenario: Non-Windows paths are unaffected
- **WHEN** evaluated code contains `import('node:path')` or `import('./relative.js')`
- **THEN** the import paths SHALL remain unchanged

#### Scenario: Patch survives npm install
- **WHEN** `npm install` is run in the project
- **THEN** the `postinstall` script SHALL apply the tidewave patch automatically via patch-package
