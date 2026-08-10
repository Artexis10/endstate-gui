/**
 * One-time post-capture Endstate Cloud invitation.
 *
 * PRINCIPLES.md §1: "There will never be a nag screen." These tests are the
 * mechanical proof of that promise for this surface — the invitation is offered
 * at most once, only after a capture the user actually saved, never to an
 * active subscriber, never alongside the auto-backup consent dialog, never on a
 * failed / cancelled / unsaved capture, never on the restore surface, and never
 * again once answered. The persisted flag is written BEFORE the card renders,
 * so a crash mid-presentation spends the invitation rather than re-arming it.
 *
 * PRINCIPLES.md §7 (no telemetry) and §1 ("Free does not mean reduced"): the
 * card is presentational and gated entirely on locally persisted settings — no
 * network call, no measurement, and it withholds nothing from the local flow.
 */

import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import { SaveFlow, type SaveFlowProps } from './save-flow';
import { SetupFlow } from './setup-flow';

const INVITATION = 'save-flow-cloud-invitation';

const captureResult = {
  count: 3,
  draftText: '{"version":2,"apps":[]}',
  apps: [
    { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code' },
    { id: 'VideoLAN.VLC', name: 'VLC media player' },
    { id: 'Mozilla.Firefox', name: 'Firefox' },
  ],
  outputPath: 'C:\\cache\\capture.zip',
  outputFormat: 'zip' as const,
  configsIncluded: ['apps.vscode', 'apps.vlc', 'apps.stale'],
  configModules: [
    {
      id: 'apps.vscode',
      appId: 'vscode',
      displayName: 'Visual Studio Code',
      status: 'captured' as const,
      filesCaptured: 3,
      wingetRefs: ['Microsoft.VisualStudioCode'],
    },
    {
      id: 'apps.vlc',
      appId: 'vlc',
      displayName: 'VLC media player',
      status: 'captured' as const,
      filesCaptured: 1,
      wingetRefs: ['VideoLAN.VLC'],
    },
    {
      id: 'apps.stale',
      appId: 'stale',
      displayName: 'Not captured',
      status: 'skipped' as const,
      filesCaptured: 0,
      wingetRefs: [],
    },
  ],
};

/** Baseline: every eligibility condition holds. */
const eligibleProps: Partial<SaveFlowProps> = {
  cloudInvitationShownAt: null,
  cloudInvitationDismissed: false,
  endstateCloudAvailable: true,
  cloudInvitationManagedAccountSeen: false,
  hostedBackupSupported: false,
  hostedBackupSignedIn: false,
  hostedBackupSubscriptionStatus: undefined,
  autoBackupConsentPending: false,
  onCloudInvitationShown: vi.fn(() => true),
  onCloudInvitationDismissed: vi.fn(() => true),
};

function renderSaveFlow(overrides: Partial<SaveFlowProps> = {}) {
  const onSaveToFile = overrides.onSaveToFile ?? vi.fn().mockResolvedValue({
    saved: true,
    path: 'C:\\Users\\test\\Documents\\capture.endstate',
  });
  renderWithProviders(
    <SaveFlow
      onBack={vi.fn()}
      engineConnected={true}
      isRunning={false}
      captureStage={null}
      liveAppEvents={[]}
      onStartCapture={vi.fn().mockResolvedValue(captureResult)}
      {...eligibleProps}
      {...overrides}
      onSaveToFile={onSaveToFile}
    />,
  );
}

/** Scan → done. The capture succeeded but nothing has been saved yet. */
async function scan() {
  fireEvent.click(screen.getByRole('button', { name: /start scan/i }));
  await screen.findByRole('button', { name: /save file/i });
}

/** Scan → save. Reaches the `saved` terminal card. */
async function scanAndSave() {
  await scan();
  fireEvent.click(screen.getByRole('button', { name: /save file/i }));
  await screen.findByText('Backup saved');
}

describe('SaveFlow — post-capture cloud invitation', () => {
  describe('eligibility', () => {
    it('presents the invitation once a capture has been captured AND saved', async () => {
      renderSaveFlow();
      await scanAndSave();

      expect(screen.getByTestId(INVITATION)).toBeInTheDocument();
    });

    it('does not present it on a successful capture that has not been saved', async () => {
      renderSaveFlow();
      await scan();

      expect(screen.getByText('Scan complete')).toBeInTheDocument();
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('does not present it when the save dialog was cancelled', async () => {
      const onSaveToFile = vi.fn().mockResolvedValue({ saved: false });
      renderSaveFlow({ onSaveToFile });
      await scan();
      fireEvent.click(screen.getByRole('button', { name: /save file/i }));

      await waitFor(() => expect(onSaveToFile).toHaveBeenCalledTimes(1));
      expect(screen.getByText('Scan complete')).toBeInTheDocument();
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('does not present it when the capture failed', async () => {
      renderSaveFlow({
        onStartCapture: vi.fn().mockRejectedValue(new Error('winget is unavailable')),
      });
      fireEvent.click(screen.getByRole('button', { name: /start scan/i }));

      await screen.findByText('Scan failed');
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('does not present it when the save failed', async () => {
      renderSaveFlow({
        onSaveToFile: vi.fn().mockRejectedValue(new Error('The destination is unavailable')),
      });
      await scan();
      fireEvent.click(screen.getByRole('button', { name: /save file/i }));

      await screen.findByText('Save failed');
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('does not present it when it has already been shown once', async () => {
      renderSaveFlow({ cloudInvitationShownAt: '2026-08-01T10:00:00.000Z' });
      await scanAndSave();

      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('does not present it when the user has already dismissed it', async () => {
      renderSaveFlow({ cloudInvitationDismissed: true });
      await scanAndSave();

      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('does not present it after a managed Endstate Cloud account was seen', async () => {
      renderSaveFlow({
        cloudInvitationManagedAccountSeen: true,
      });
      await scanAndSave();

      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it.each([
      ['active', 'active' as const],
      ['grace', 'grace' as const],
      ['cancelled', 'cancelled' as const],
      ['none', 'none' as const],
    ])('does not present it to a currently signed-in %s Endstate Cloud user', async (_label, subscriptionStatus) => {
      renderSaveFlow({ hostedBackupSignedIn: true, hostedBackupSubscriptionStatus: subscriptionStatus });
      await scanAndSave();

      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('presents it to a first-time signed-out managed user', async () => {
      renderSaveFlow({ hostedBackupSignedIn: false, hostedBackupSubscriptionStatus: undefined });
      await scanAndSave();

      expect(screen.getByTestId(INVITATION)).toBeInTheDocument();
    });

    it('does not present it when Endstate Cloud is unavailable', async () => {
      renderSaveFlow({ endstateCloudAvailable: false });
      await scanAndSave();

      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('does not present it while the auto-backup consent prompt is open or pending', async () => {
      renderSaveFlow({ autoBackupConsentPending: true });
      await scanAndSave();

      // Never two prompts from one capture.
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('never presents it on the restore surface, including a completed restore', async () => {
      const profile = { name: 'work-pc', path: 'C:\\profiles\\work-pc.jsonc' };
      renderWithProviders(
        <SetupFlow
          profiles={[profile]}
          onBack={vi.fn()}
          onOpenProfilesFolder={vi.fn()}
          onRefreshProfiles={vi.fn().mockResolvedValue(undefined)}
          onFileDrop={vi.fn()}
          onDeleteProfile={vi.fn()}
          isRunning={false}
          setupProgress={null}
          liveAppEvents={[]}
          onPreview={vi.fn().mockResolvedValue({
            installed: 1,
            alreadyPresent: 0,
            appEvents: [],
            actions: [{ type: 'install', id: 'vlc', ref: 'VideoLAN.VLC', status: 'to_install', message: '' }],
          })}
          onApply={vi.fn().mockResolvedValue({
            success: true,
            installed: 1,
            alreadyPresent: 0,
            failed: 0,
            skipped: 0,
            appEvents: [],
            dryRun: false,
          })}
        />,
      );

      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
      await userEvent.click(screen.getByTestId(`profile-card-${profile.name}`));
      await screen.findByTestId('setup-flow-apply');
      await userEvent.click(screen.getByTestId('setup-flow-apply'));

      await screen.findByText('Setup complete');
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });
  });

  describe('record before present', () => {
    it('re-checks eligibility after a deferred native save when sign-in state changes', async () => {
      let resolveSave!: (outcome: { saved: boolean; path: string }) => void;
      const onSaveToFile = vi.fn(() => new Promise<{ saved: boolean; path: string }>((resolve) => {
        resolveSave = resolve;
      }));
      const { rerender } = renderWithProviders(
        <SaveFlow
          onBack={vi.fn()}
          engineConnected={true}
          isRunning={false}
          captureStage={null}
          liveAppEvents={[]}
          onStartCapture={vi.fn().mockResolvedValue(captureResult)}
          onSaveToFile={onSaveToFile}
          {...eligibleProps}
        />,
      );
      await scan();
      fireEvent.click(screen.getByRole('button', { name: /save file/i }));

      rerender(
        <SaveFlow
          onBack={vi.fn()}
          engineConnected={true}
          isRunning={false}
          captureStage={null}
          liveAppEvents={[]}
          onStartCapture={vi.fn().mockResolvedValue(captureResult)}
          onSaveToFile={onSaveToFile}
          {...eligibleProps}
          hostedBackupSignedIn={true}
        />,
      );
      resolveSave({ saved: true, path: 'C:\\out.endstate' });

      await screen.findByText('Backup saved');
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('persists the shown-at flag before the card renders', async () => {
      const renderedWhenRecorded: boolean[] = [];
      const onCloudInvitationShown = vi.fn(() => {
        // If the card were already mounted, a crash here would leave the
        // invitation un-recorded and it would return on the next capture.
        renderedWhenRecorded.push(screen.queryByTestId(INVITATION) !== null);
        return true;
      });

      renderSaveFlow({ onCloudInvitationShown });
      await scanAndSave();

      expect(onCloudInvitationShown).toHaveBeenCalledTimes(1);
      expect(renderedWhenRecorded).toEqual([false]);
      expect(screen.getByTestId(INVITATION)).toBeInTheDocument();
    });

    it('does not record anything when the invitation is not eligible', async () => {
      const onCloudInvitationShown = vi.fn();
      renderSaveFlow({ cloudInvitationDismissed: true, onCloudInvitationShown });
      await scanAndSave();

      expect(onCloudInvitationShown).not.toHaveBeenCalled();
    });

    it('does not render when durable invitation recording fails', async () => {
      const onCloudInvitationShown = vi.fn(() => false);
      renderSaveFlow({ onCloudInvitationShown });
      await scanAndSave();

      expect(onCloudInvitationShown).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('keeps the card visible after the parent records the shown-at flag', async () => {
      // The parent re-renders with cloudInvitationShownAt set the moment it is
      // recorded. The session latch, not the persisted flag, keeps the card up.
      const { rerender } = renderWithProviders(
        <SaveFlow
          onBack={vi.fn()}
          engineConnected={true}
          isRunning={false}
          captureStage={null}
          liveAppEvents={[]}
          onStartCapture={vi.fn().mockResolvedValue(captureResult)}
          onSaveToFile={vi.fn().mockResolvedValue({ saved: true, path: 'C:\\out.endstate' })}
          {...eligibleProps}
        />,
      );
      await scanAndSave();
      expect(screen.getByTestId(INVITATION)).toBeInTheDocument();

      rerender(
        <SaveFlow
          onBack={vi.fn()}
          engineConnected={true}
          isRunning={false}
          captureStage={null}
          liveAppEvents={[]}
          onStartCapture={vi.fn().mockResolvedValue(captureResult)}
          onSaveToFile={vi.fn().mockResolvedValue({ saved: true, path: 'C:\\out.endstate' })}
          {...eligibleProps}
          cloudInvitationShownAt="2026-08-08T09:00:00.000Z"
        />,
      );

      expect(screen.getByTestId(INVITATION)).toBeInTheDocument();
    });
  });

  describe('dismissal is permanent', () => {
    it('retires the invitation when the user keeps it local', async () => {
      const onCloudInvitationDismissed = vi.fn(() => true);
      renderSaveFlow({ onCloudInvitationDismissed });
      await scanAndSave();

      fireEvent.click(screen.getByRole('button', { name: 'Keep it local' }));

      expect(onCloudInvitationDismissed).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('retires the invitation from its accessible close control', async () => {
      const onCloudInvitationDismissed = vi.fn(() => true);
      renderSaveFlow({ onCloudInvitationDismissed });
      await scanAndSave();

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss Endstate Cloud invitation' }));

      expect(onCloudInvitationDismissed).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('retires the invitation when Escape is pressed', async () => {
      const onCloudInvitationDismissed = vi.fn(() => true);
      renderSaveFlow({ onCloudInvitationDismissed });
      await scanAndSave();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onCloudInvitationDismissed).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('retires the invitation when the user clicks outside it', async () => {
      const onCloudInvitationDismissed = vi.fn(() => true);
      renderSaveFlow({ onCloudInvitationDismissed });
      await scanAndSave();

      fireEvent.pointerDown(document.body);

      expect(onCloudInvitationDismissed).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('retires the invitation and routes to the hosted-backup pane on the primary action', async () => {
      const onCloudInvitationDismissed = vi.fn(() => true);
      const onOpenHostedBackup = vi.fn();
      renderSaveFlow({ onCloudInvitationDismissed, onOpenHostedBackup });
      await scanAndSave();

      fireEvent.click(screen.getByRole('button', { name: 'Open Endstate Cloud' }));

      expect(onCloudInvitationDismissed).toHaveBeenCalledTimes(1);
      expect(onOpenHostedBackup).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('stays visible when dismissal cannot be persisted', async () => {
      const onCloudInvitationDismissed = vi.fn(() => false);
      renderSaveFlow({ onCloudInvitationDismissed });
      await scanAndSave();

      fireEvent.click(screen.getByRole('button', { name: 'Keep it local' }));

      expect(onCloudInvitationDismissed).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(INVITATION)).toBeInTheDocument();
    });

    // Does not lean on the parent having persisted and propagated the decision:
    // "Save another copy" re-enters the save path immediately, so the component
    // itself must treat the invitation as spent.
    it('does not return when another copy is saved in the same session', async () => {
      const onSaveToFile = vi
        .fn()
        .mockResolvedValue({ saved: true, path: 'C:\\Users\\test\\capture.endstate' });
      renderSaveFlow({ onSaveToFile });
      await scanAndSave();
      fireEvent.click(screen.getByRole('button', { name: 'Keep it local' }));

      fireEvent.click(screen.getByRole('button', { name: /save another copy/i }));

      await waitFor(() => expect(onSaveToFile).toHaveBeenCalledTimes(2));
      expect(screen.getByText('Backup saved')).toBeInTheDocument();
      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });

    it('does not return on a later capture once the decision is persisted', async () => {
      // Second run of the app: the parent replays the persisted decision.
      renderSaveFlow({
        cloudInvitationShownAt: '2026-08-08T09:00:00.000Z',
        cloudInvitationDismissed: true,
      });
      await scanAndSave();

      expect(screen.queryByTestId(INVITATION)).not.toBeInTheDocument();
    });
  });

  describe('presentation', () => {
    it('announces itself politely without stealing focus or blocking', async () => {
      renderSaveFlow();
      await scanAndSave();

      const card = screen.getByTestId(INVITATION);
      expect(card).toHaveAttribute('role', 'status');
      expect(card).toHaveAttribute('aria-live', 'polite');
      // The completion actions stay reachable — nothing is gated behind it.
      expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
    });

    it('states the saved-locally outcome and the offer without a price', async () => {
      renderSaveFlow();
      await scanAndSave();

      const card = screen.getByTestId(INVITATION);
      expect(screen.getByText('Your setup is saved locally')).toBeInTheDocument();
      expect(
        screen.getByText('3 applications and 2 supported settings were captured.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Keep an encrypted version with Endstate Cloud'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Store protected versions of this setup without managing the backup location yourself.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Open Endstate Cloud' })).toBeInTheDocument();
      // No price: the GUI has no reliable price source, and an invitation that
      // quotes one is a sales surface.
      expect(card.textContent).not.toMatch(/[€$£]|\/month|per month/i);
    });

    it('uses the same settings count as the scan headline', async () => {
      // Guardrail: "must never compute counts differently across UI components".
      // configsIncluded has 3 ids; only 2 modules actually captured.
      renderSaveFlow();
      await scan();
      expect(screen.getByText(/2 settings captured/)).toBeInTheDocument();
      expect(screen.queryByText(/3 settings captured/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /save file/i }));
      await screen.findByText('Backup saved');
      expect(
        screen.getByText('3 applications and 2 supported settings were captured.'),
      ).toBeInTheDocument();
    });

    it('falls back to the engine config id list when structured modules are absent', async () => {
      renderSaveFlow({
        onStartCapture: vi.fn().mockResolvedValue({
          ...captureResult,
          configModules: undefined,
        }),
      });
      await scanAndSave();

      expect(
        screen.getByText('3 applications and 3 supported settings were captured.'),
      ).toBeInTheDocument();
    });
  });
});
