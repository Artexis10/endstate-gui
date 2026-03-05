## ADDED Requirements

### Requirement: Tag-triggered release workflow
The system SHALL run a GitHub Actions workflow when a tag matching `gui-v*` is pushed to the repository. The workflow SHALL create a GitHub Release for that tag.

#### Scenario: Tag push triggers release creation
- **WHEN** a tag matching `gui-v*` (e.g., `gui-v1.0.1`) is pushed
- **THEN** the workflow creates a GitHub Release named "GUI {version}" where {version} is the tag with the `gui-v` prefix stripped

### Requirement: Changelog body extraction
The workflow SHALL extract the release body from CHANGELOG.md by finding the section matching the tagged version.

#### Scenario: Matching changelog section exists
- **WHEN** CHANGELOG.md contains a section headed `## [{version}]`
- **THEN** the release body SHALL contain the content between that header and the next `## [` header (or end of file)

#### Scenario: No matching changelog section
- **WHEN** CHANGELOG.md does not contain a section for the tagged version
- **THEN** the release body SHALL fall back to "See CHANGELOG.md"

### Requirement: Release metadata
The workflow SHALL set `make_latest: true` on the created release so it appears as the latest release on the repository.

#### Scenario: Release is marked latest
- **WHEN** the release is created
- **THEN** it SHALL be flagged as the latest release on the GitHub repository
