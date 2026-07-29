/**
 * A run that changed nothing must never be presented as one that did.
 *
 * The GUI shipped with dryRunEnabled defaulting to true, so the primary action
 * appended --dry-run, installed nothing, and the results screen still read
 * "Setup complete". The engine reported `dryRun` on every apply envelope the
 * whole time; nothing read it. These tests pin the disclosure so the copy
 * cannot silently regress to claiming work that never happened.
 *
 * See docs/contracts/gui-integration-contract.md, "Dry-Run Disclosure".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../../../test/test-utils';
import { SetupFlow } from './setup-flow';

const mockProfile = {
  name: 'hugo-desktop',
  path: 'C:\\profiles\\hugo-desktop.jsonc',
  displayName: 'hugo-desktop',
};

const previewResult = {
  installed: 1,
  alreadyPresent: 1,
  appEvents: [
    { app: 'Warp.Warp', action: 'To install', name: 'Warp', timestamp: 1, statusKey: 'to_install' as const },
    { app: 'VideoLAN.VLC', action: 'OK', name: 'VLC', timestamp: 2, statusKey: 'present' as const },
  ],
  actions: [
    { type: 'install', id: 'warp', ref: 'Warp.Warp', status: 'to_install', message: '' },
    { type: 'install', id: 'vlc', ref: 'VideoLAN.VLC', status: 'present', message: '' },
  ],
};

const baseProps = {
  profiles: [mockProfile],
  onBack: vi.fn(),
  onOpenProfilesFolder: vi.fn(),
  onRefreshProfiles: vi.fn().mockResolvedValue(undefined),
  onFileDrop: vi.fn(),
  onDeleteProfile: vi.fn(),
  isRunning: false,
  setupProgress: null,
  liveAppEvents: [],
  onPreview: vi.fn(),
  onApply: vi.fn(),
};

function applyResult(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    installed: 1,
    alreadyPresent: 1,
    failed: 0,
    skipped: 0,
    appEvents: [],
    ...overrides,
  };
}

async function runApply(result: Record<string, unknown>) {
  const onPreview = vi.fn().mockResolvedValue(previewResult);
  const onApply = vi.fn().mockResolvedValue(result);
  renderWithProviders(
    <SetupFlow {...baseProps} onPreview={onPreview} onApply={onApply} />,
  );

  await userEvent.click(screen.getByTestId(`profile-card-${mockProfile.name}`));
  await screen.findByTestId('setup-flow-apply');
  await userEvent.click(screen.getByTestId('setup-flow-apply'));
}

describe('SetupFlow dry-run disclosure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not claim setup completed when the run was a dry run', async () => {
    await runApply(applyResult({ dryRun: true }));

    expect(await screen.findByText(/nothing was installed/i)).toBeInTheDocument();
    expect(screen.queryByText('Setup complete')).not.toBeInTheDocument();
  });

  it('does not report installs for a dry run', async () => {
    await runApply(applyResult({ dryRun: true }));

    // "1 installed" would assert work that never happened.
    expect(await screen.findByText(/would be installed/i)).toBeInTheDocument();
    expect(screen.queryByText(/^1 installed,/)).not.toBeInTheDocument();
  });

  it('reports completed setup for a real apply', async () => {
    await runApply(applyResult({ dryRun: false }));

    expect(await screen.findByText('Setup complete')).toBeInTheDocument();
    expect(screen.queryByText(/nothing was installed/i)).not.toBeInTheDocument();
  });

  it('treats a missing dryRun flag as a real apply', async () => {
    // Older engines omit the field. Defaulting to "preview" would under-report a
    // run that genuinely installed things, which is the opposite failure.
    await runApply(applyResult());

    expect(await screen.findByText('Setup complete')).toBeInTheDocument();
  });

  it('still reports errors ahead of dry-run copy', async () => {
    await runApply(applyResult({ dryRun: true, failed: 1, success: false }));

    expect(await screen.findByText('Setup completed with errors')).toBeInTheDocument();
  });
});
