import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '../../../test/test-utils';
import { SetupFlow } from './setup-flow';

const mockProfile = {
  name: 'mixed-drivers',
  path: 'C:\\profiles\\mixed-drivers.jsonc',
  displayName: 'Mixed drivers',
};

const previewWarning = {
  code: 'possible_duplicate',
  message: 'winget and Chocolatey entries may refer to the same product.',
  driver: 'choco',
  ref: 'git.install',
};

const liveWarning = {
  code: 'package_advisory',
  message: 'Live apply warning from the final envelope.',
  driver: 'winget',
  ref: 'Git.Git',
};

const previewResult = {
  installed: 2,
  alreadyPresent: 1,
  appEvents: [
    { app: 'Git.Git', action: 'To install', name: 'Git (winget)', timestamp: 1, statusKey: 'to_install' as const },
    { app: 'git.install', action: 'To install', name: 'Git (Chocolatey)', timestamp: 2, statusKey: 'to_install' as const },
    { app: 'Mozilla.Firefox', action: 'OK', name: 'Firefox', timestamp: 3, statusKey: 'present' as const },
  ],
  actions: [
    { type: 'install', id: 'git-winget', ref: 'Git.Git', status: 'to_install', message: '' },
    { type: 'install', id: 'git-choco', ref: 'git.install', status: 'to_install', message: '' },
    { type: 'install', id: 'firefox', ref: 'Mozilla.Firefox', status: 'present', message: '' },
  ],
  warnings: [previewWarning],
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

function successfulApply(overrides: Record<string, unknown> = {}) {
  return {
    installed: 2,
    alreadyPresent: 1,
    failed: 0,
    skipped: 0,
    appEvents: [],
    ...overrides,
  };
}

function warningMessages(): string[] {
  const region = screen.getByRole('region', { name: /warnings/i });
  return within(region).getAllByRole('listitem').map((item) => item.textContent ?? '');
}

async function renderPreview(overrides: Record<string, unknown> = {}) {
  const onPreview = vi.fn().mockResolvedValue(previewResult);
  const onApply = vi.fn().mockResolvedValue(successfulApply());
  const view = renderWithProviders(
    <SetupFlow {...baseProps} onPreview={onPreview} onApply={onApply} {...overrides} />,
  );

  await userEvent.click(screen.getByTestId(`profile-card-${mockProfile.name}`));
  await screen.findByTestId('setup-flow-apply');
  return { ...view, onPreview, onApply };
}

describe('SetupFlow command warnings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps preview warnings advisory while preserving items, statuses, counts, actions, and subset behavior', async () => {
    const onApply = vi.fn().mockResolvedValue(successfulApply());
    await renderPreview({ onApply, applyOnlySupported: true });

    expect(warningMessages()).toEqual([
      expect.stringContaining(previewWarning.message),
    ]);
    expect(screen.getByText('2 to install, 1 already present')).toBeInTheDocument();
    expect(screen.getByText('Git (winget)')).toBeInTheDocument();
    expect(screen.getByText('Git (Chocolatey)')).toBeInTheDocument();
    expect(screen.getAllByText('TO INSTALL')).toHaveLength(2);
    expect(screen.getByTestId('app-picker-count')).toHaveTextContent('3 of 3 selected');
    expect(screen.getByTestId('setup-flow-apply')).toBeEnabled();

    const warningsBeforeSubsetChange = warningMessages();
    await userEvent.click(screen.getByTestId('app-picker-checkbox-git-choco'));

    expect(warningMessages()).toEqual(warningsBeforeSubsetChange);
    expect(screen.getByText('1 to install, 1 already present')).toBeInTheDocument();
    expect(screen.getByText('Git (Chocolatey)')).toBeInTheDocument();
    expect(screen.getByTestId('app-picker-count')).toHaveTextContent('2 of 3 selected');

    await userEvent.click(screen.getByTestId('setup-flow-apply'));
    expect(onApply).toHaveBeenCalledWith(mockProfile, {
      onlyAppIds: ['git-winget', 'firefox'],
    });
  });

  it('replaces preview warnings with the live apply warning list', async () => {
    const onApply = vi.fn().mockResolvedValue(successfulApply({ warnings: [liveWarning] }));
    await renderPreview({ onApply });

    expect(screen.getByText(previewWarning.message, { exact: true })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('setup-flow-apply'));

    expect(await screen.findByText(liveWarning.message, { exact: true })).toBeInTheDocument();
    expect(screen.queryByText(previewWarning.message, { exact: true })).not.toBeInTheDocument();
    expect(warningMessages()).toHaveLength(1);
  });

  it.each([
    ['omitted', {}],
    ['empty', { warnings: [] }],
  ])('clears preview warnings when live apply warnings are %s', async (_label, warningShape) => {
    const onApply = vi.fn().mockResolvedValue(successfulApply(warningShape));
    await renderPreview({ onApply });

    expect(screen.getByRole('region', { name: /warnings/i })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('setup-flow-apply'));

    await screen.findByText('Setup complete');
    expect(screen.queryByRole('region', { name: /warnings/i })).not.toBeInTheDocument();
    expect(screen.queryByText(previewWarning.message, { exact: true })).not.toBeInTheDocument();
  });

  it('clears the current warning list when the parent resets the flow', async () => {
    const { rerender } = await renderPreview({ resetKey: 0 });

    expect(screen.getByRole('region', { name: /warnings/i })).toBeInTheDocument();
    rerender(<SetupFlow {...baseProps} onPreview={vi.fn()} onApply={vi.fn()} resetKey={1} />);

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /warnings/i })).not.toBeInTheDocument();
    });
    expect(screen.getByTestId(`profile-card-${mockProfile.name}`)).toBeInTheDocument();
  });

  it('clears preview A while preview B is still pending', async () => {
    const previewBWarning = {
      code: 'package_advisory',
      message: 'Warning from preview B.',
    };
    const previewB = {
      ...previewResult,
      warnings: [previewBWarning],
    };
    let resolvePreviewB!: (result: typeof previewB) => void;
    const pendingPreviewB = new Promise<typeof previewB>((resolve) => {
      resolvePreviewB = resolve;
    });
    const onPreview = vi.fn()
      .mockResolvedValueOnce(previewResult)
      .mockReturnValueOnce(pendingPreviewB);
    renderWithProviders(
      <SetupFlow
        {...baseProps}
        onPreview={onPreview}
        onApply={vi.fn().mockResolvedValue(successfulApply())}
      />,
    );

    await userEvent.click(screen.getByTestId(`profile-card-${mockProfile.name}`));
    await screen.findByText(previewWarning.message, { exact: true });
    await userEvent.click(screen.getByTestId('setup-flow-back'));
    await userEvent.click(screen.getByTestId(`profile-card-${mockProfile.name}`));

    expect(onPreview).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Previewing changes...')).toBeInTheDocument();
    expect(screen.queryByText(previewWarning.message, { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /warnings/i })).not.toBeInTheDocument();

    resolvePreviewB(previewB);
    expect(await screen.findByText(previewBWarning.message, { exact: true })).toBeInTheDocument();
  });

  it('does not change partial-failure status, counts, item copy, or controls', async () => {
    const partialWarning = {
      code: 'driver_advisory',
      message: 'One package failed; this advisory is not the failure state.',
    };
    const onApply = vi.fn().mockResolvedValue(successfulApply({
      installed: 1,
      alreadyPresent: 1,
      failed: 1,
      appEvents: [
        { app: 'git.install', action: 'Failed', name: 'Git (Chocolatey)', timestamp: 4, statusKey: 'failed' },
      ],
      warnings: [partialWarning],
    }));
    await renderPreview({ onApply });

    await userEvent.click(screen.getByTestId('setup-flow-apply'));

    expect(await screen.findByText('Setup completed with errors')).toBeInTheDocument();
    expect(screen.getByText('1 installed, 1 already present, 1 failed')).toBeInTheDocument();
    expect(screen.getByText('Git (Chocolatey)')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText(partialWarning.message, { exact: true })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Back to profiles' })[0]).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
