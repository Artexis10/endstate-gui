/**
 * SetupFlow — per-app picker (apply --only).
 *
 * The picker is capability-gated on the engine advertising `apply --only`
 * (`applyOnlySupported` prop). Selection is presentation-only: the component
 * re-slices engine-reported counts and passes manifest app ids up via
 * `onApply(profile, { onlyAppIds })` ONLY for a strict subset. All-selected
 * omits the field so the invocation is identical to a picker-less run.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import userEvent from '@testing-library/user-event';
import { SetupFlow } from './setup-flow';

const mockProfile = {
  name: 'test-profile',
  path: 'C:\\profiles\\test-profile.jsonc',
  displayName: 'test-profile',
  extension: '.jsonc' as const,
  isBundle: false,
};

const baseProps = {
  profiles: [mockProfile],
  onBack: vi.fn(),
  onProfileSelect: vi.fn(),
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

/**
 * Preview result shaped like the real dry-run: streamed appEvents keyed by
 * winget ref, envelope actions carrying the manifest app `id` (what --only
 * matches on) plus the ref. git-git/7zip-7zip to install, firefox present.
 */
function makePreviewWithActions() {
  return {
    installed: 2,
    alreadyPresent: 1,
    appEvents: [
      { app: 'Git.Git', action: 'To install', name: 'Git', timestamp: 1 },
      { app: '7zip.7zip', action: 'To install', name: '7-Zip', timestamp: 2 },
      { app: 'Mozilla.Firefox', action: 'OK', name: 'Firefox', timestamp: 3 },
    ],
    actions: [
      { type: 'install', id: 'git-git', ref: 'Git.Git', status: 'to_install', message: '' },
      { type: 'install', id: '7zip-7zip', ref: '7zip.7zip', status: 'to_install', message: '' },
      { type: 'install', id: 'firefox', ref: 'Mozilla.Firefox', status: 'present', message: '' },
    ],
  };
}

async function renderToPreviewDone(props: Record<string, unknown>) {
  renderWithProviders(<SetupFlow {...baseProps} {...props} />);
  const profileButton = screen.getByText('test-profile');
  await userEvent.click(profileButton);
  await waitFor(() => {
    expect(screen.getByTestId('setup-flow-apply')).toBeInTheDocument();
  });
}

describe('SetupFlow — per-app picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('capability gating', () => {
    it('renders no picker without applyOnlySupported (dark by default)', async () => {
      const onPreview = vi.fn().mockResolvedValue(makePreviewWithActions());
      await renderToPreviewDone({ onPreview });

      expect(screen.queryByTestId('app-picker-header')).not.toBeInTheDocument();
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });

    it('omits picker options from onApply when dark', async () => {
      const onPreview = vi.fn().mockResolvedValue(makePreviewWithActions());
      const onApply = vi.fn().mockResolvedValue({
        installed: 2, alreadyPresent: 1, failed: 0, skipped: 0, appEvents: [],
      });
      await renderToPreviewDone({ onPreview, onApply });

      await userEvent.click(screen.getByTestId('setup-flow-apply'));

      expect(onApply).toHaveBeenCalledWith(mockProfile, undefined);
    });

    it('renders no picker when capability is on but preview carries no actions', async () => {
      const preview = makePreviewWithActions();
      const onPreview = vi.fn().mockResolvedValue({ ...preview, actions: undefined });
      await renderToPreviewDone({ onPreview, applyOnlySupported: true });

      expect(screen.queryByTestId('app-picker-header')).not.toBeInTheDocument();
    });
  });

  describe('selection defaults and affordances', () => {
    it('defaults to all apps checked with an N of M header', async () => {
      const onPreview = vi.fn().mockResolvedValue(makePreviewWithActions());
      await renderToPreviewDone({ onPreview, applyOnlySupported: true });

      expect(screen.getByTestId('app-picker-count')).toHaveTextContent('3 of 3 selected');
      expect(screen.getByTestId('app-picker-checkbox-git-git')).toBeChecked();
      expect(screen.getByTestId('app-picker-checkbox-7zip-7zip')).toBeChecked();
      expect(screen.getByTestId('app-picker-checkbox-firefox')).toBeChecked();
    });

    it('select none unchecks everything and disables Apply', async () => {
      const onPreview = vi.fn().mockResolvedValue(makePreviewWithActions());
      await renderToPreviewDone({ onPreview, applyOnlySupported: true });

      await userEvent.click(screen.getByTestId('app-picker-select-none'));

      expect(screen.getByTestId('app-picker-count')).toHaveTextContent('0 of 3 selected');
      expect(screen.getByTestId('app-picker-checkbox-git-git')).not.toBeChecked();
      expect(screen.getByTestId('setup-flow-apply')).toBeDisabled();
    });

    it('select all restores the full selection and re-enables Apply', async () => {
      const onPreview = vi.fn().mockResolvedValue(makePreviewWithActions());
      const onApply = vi.fn().mockResolvedValue({
        installed: 2, alreadyPresent: 1, failed: 0, skipped: 0, appEvents: [],
      });
      await renderToPreviewDone({ onPreview, onApply, applyOnlySupported: true });

      await userEvent.click(screen.getByTestId('app-picker-select-none'));
      await userEvent.click(screen.getByTestId('app-picker-select-all'));

      expect(screen.getByTestId('app-picker-count')).toHaveTextContent('3 of 3 selected');
      const applyButton = screen.getByTestId('setup-flow-apply');
      expect(applyButton).toBeEnabled();

      // Full selection → identical to today: no onlyAppIds field at all.
      await userEvent.click(applyButton);
      expect(onApply).toHaveBeenCalledWith(mockProfile, undefined);
    });

    it('updates the summary counts client-side as apps are unchecked', async () => {
      const onPreview = vi.fn().mockResolvedValue(makePreviewWithActions());
      await renderToPreviewDone({ onPreview, applyOnlySupported: true });

      expect(screen.getByText('2 to install, 1 already present')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('app-picker-checkbox-git-git'));

      expect(screen.getByText('1 to install, 1 already present')).toBeInTheDocument();
      expect(screen.getByTestId('app-picker-count')).toHaveTextContent('2 of 3 selected');
    });
  });

  describe('subset arg construction', () => {
    it('passes the exact manifest app ids when a strict subset is selected', async () => {
      const onPreview = vi.fn().mockResolvedValue(makePreviewWithActions());
      const onApply = vi.fn().mockResolvedValue({
        installed: 1, alreadyPresent: 1, failed: 0, skipped: 0, appEvents: [],
      });
      await renderToPreviewDone({ onPreview, onApply, applyOnlySupported: true });

      await userEvent.click(screen.getByTestId('app-picker-checkbox-7zip-7zip'));
      await userEvent.click(screen.getByTestId('setup-flow-apply'));

      expect(onApply).toHaveBeenCalledWith(mockProfile, {
        onlyAppIds: ['git-git', 'firefox'],
      });
    });

    it('always includes manual/config-only app ids in a subset (no checkbox for them)', async () => {
      const base = makePreviewWithActions();
      const preview = {
        ...base,
        alreadyPresent: 2,
        appEvents: [
          ...base.appEvents,
          { app: 'lightroom', action: 'OK', name: 'Lightroom Classic', timestamp: 4, driver: 'manual' },
        ],
        actions: [
          ...base.actions,
          { type: 'install', id: 'lightroom', ref: null, status: 'present', message: '' },
        ],
      };
      const onPreview = vi.fn().mockResolvedValue(preview);
      const onApply = vi.fn().mockResolvedValue({
        installed: 1, alreadyPresent: 2, failed: 0, skipped: 0, appEvents: [],
      });
      await renderToPreviewDone({ onPreview, onApply, applyOnlySupported: true });

      // Manual apps are governed by the restore-intent controls — no checkbox.
      expect(screen.queryByTestId('app-picker-checkbox-lightroom')).not.toBeInTheDocument();
      expect(screen.getByTestId('app-picker-count')).toHaveTextContent('3 of 3 selected');

      await userEvent.click(screen.getByTestId('app-picker-checkbox-git-git'));
      await userEvent.click(screen.getByTestId('setup-flow-apply'));

      expect(onApply).toHaveBeenCalledWith(mockProfile, {
        onlyAppIds: ['7zip-7zip', 'firefox', 'lightroom'],
      });
    });

    it('composes onlyAppIds with the restore-intent options', async () => {
      const preview = {
        ...makePreviewWithActions(),
        restoreModulesAvailable: [{ id: 'git', displayName: 'Git' }],
        configModuleMap: { 'Git.Git': 'apps.git' } as Record<string, string>,
      };
      const onPreview = vi.fn().mockResolvedValue(preview);
      const onApply = vi.fn().mockResolvedValue({
        installed: 2, alreadyPresent: 0, failed: 0, skipped: 0, appEvents: [],
      });
      await renderToPreviewDone({ onPreview, onApply, applyOnlySupported: true });

      const appsAndSettingsRadio = screen.getByRole('radio', { name: /settings/i });
      await userEvent.click(appsAndSettingsRadio);
      await userEvent.click(screen.getByRole('checkbox', { name: /^Git$/ }));

      await userEvent.click(screen.getByTestId('app-picker-checkbox-firefox'));
      await userEvent.click(screen.getByTestId('setup-flow-apply'));

      expect(onApply).toHaveBeenCalledWith(mockProfile, {
        restoreIntent: 'apps-and-settings',
        selectedModules: ['git'],
        onlyAppIds: ['git-git', '7zip-7zip'],
      });
    });
  });

  describe('PRESENT apps stay selectable', () => {
    it('lets the user uncheck an already-present app, excluding it from the subset', async () => {
      const onPreview = vi.fn().mockResolvedValue(makePreviewWithActions());
      const onApply = vi.fn().mockResolvedValue({
        installed: 2, alreadyPresent: 0, failed: 0, skipped: 0, appEvents: [],
      });
      await renderToPreviewDone({ onPreview, onApply, applyOnlySupported: true });

      const firefoxCheckbox = screen.getByTestId('app-picker-checkbox-firefox');
      expect(firefoxCheckbox).toBeEnabled();
      await userEvent.click(firefoxCheckbox);

      expect(screen.getByText('2 to install, 0 already present')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('setup-flow-apply'));
      expect(onApply).toHaveBeenCalledWith(mockProfile, {
        onlyAppIds: ['git-git', '7zip-7zip'],
      });
    });
  });

  describe('boundary guards', () => {
    it('falls back to a full apply when an installable action lacks a manifest id', async () => {
      const base = makePreviewWithActions();
      const preview = {
        ...base,
        appEvents: [...base.appEvents, { app: 'Notepad++.Notepad++', action: 'To install', name: 'Notepad++', timestamp: 4 }],
        actions: [
          ...base.actions,
          { type: 'install', id: null, ref: 'Notepad++.Notepad++', status: 'to_install', message: '' },
        ],
      };
      const onPreview = vi.fn().mockResolvedValue(preview);
      const onApply = vi.fn().mockResolvedValue({
        installed: 3, alreadyPresent: 1, failed: 0, skipped: 0, appEvents: [],
      });
      await renderToPreviewDone({ onPreview, onApply, applyOnlySupported: true });

      await userEvent.click(screen.getByTestId('app-picker-checkbox-git-git')); // strict subset
      await userEvent.click(screen.getByTestId('setup-flow-apply'));

      await waitFor(() => expect(onApply).toHaveBeenCalled());
      // Subset mode is deactivated: the unmappable app would be silently
      // skipped by a subset run, so no onlyAppIds may be sent.
      expect(onApply).toHaveBeenCalledWith(mockProfile, undefined);
    });

    it('renders no picker and keeps Apply enabled when no installable rows exist', async () => {
      const preview = {
        installed: 1,
        alreadyPresent: 0,
        appEvents: [{ app: 'lightroom', action: 'To install', name: 'Lightroom Classic', timestamp: 1 }],
        actions: [{ type: 'install', id: 'lightroom', ref: null, status: 'to_install', message: '' }],
      };
      const onPreview = vi.fn().mockResolvedValue(preview);
      await renderToPreviewDone({ onPreview, applyOnlySupported: true });

      expect(screen.queryByTestId('app-picker-header')).not.toBeInTheDocument();
      expect(screen.getByTestId('setup-flow-apply')).toBeEnabled();
    });
  });
});
