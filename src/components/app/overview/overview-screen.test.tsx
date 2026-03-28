import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../test/test-utils';
import { OverviewScreen } from './overview-screen';
import type { OverviewScreenProps } from './types';
import type { LifecycleState } from '@/lib/lifecycle-state';

// Mock heavy child components to keep tests focused on OverviewScreen rendering logic
vi.mock('../manage-profiles-modal', () => ({
  ManageProfilesModal: () => null,
}));
vi.mock('../view-apps-modal', () => ({
  ViewAppsModal: () => null,
}));

const emptyLifecycle: LifecycleState = {
  lastCapture: null,
  lastPreview: null,
  lastApply: null,
  lastVerify: null,
};

function makeProps(overrides: Partial<OverviewScreenProps> = {}): OverviewScreenProps {
  return {
    lifecycleState: emptyLifecycle,
    selectedProfile: 'work.jsonc',
    profiles: [
      { name: 'work.jsonc', path: 'C:\\profiles\\work.jsonc', displayName: 'Work Setup' },
    ],
    profilesDirectory: 'C:\\profiles',
    isRunning: false,
    runningAction: null,
    actionStatus: 'idle',
    actionProgress: null,
    actionResult: null,
    actionStatusByAction: {},
    actionProgressByAction: {},
    actionResultByAction: {},
    onNavigate: vi.fn(),
    onCapture: vi.fn(),
    onSetup: vi.fn(),
    onCheck: vi.fn(),
    onProfileChange: vi.fn(),
    onDismissResult: vi.fn(),
    onOpenProfilesFolder: vi.fn(),
    onRefreshProfiles: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('OverviewScreen', () => {
  describe('welcome header visibility', () => {
    it('shows welcome header with branding when sidebar is hidden', () => {
      renderWithProviders(
        <OverviewScreen {...makeProps({ sidebarVisible: false })} />
      );
      expect(screen.getByText('Endstate')).toBeInTheDocument();
      expect(screen.getByText(/save your setup or set up a new machine/i)).toBeInTheDocument();
    });

    it('hides welcome header when sidebar is visible', () => {
      renderWithProviders(
        <OverviewScreen {...makeProps({ sidebarVisible: true })} />
      );
      expect(screen.queryByText('Endstate')).not.toBeInTheDocument();
    });
  });

  describe('recent activity', () => {
    it('does not show recent activity when lifecycle is empty', () => {
      renderWithProviders(<OverviewScreen {...makeProps()} />);
      expect(screen.queryByText(/recent activity/i)).not.toBeInTheDocument();
    });

    it('shows capture activity summary when lastCapture exists', () => {
      const lifecycleState: LifecycleState = {
        lastCapture: {
          timestamp: '2026-03-28T10:00:00Z',
          success: true,
          summary: { total: 10 },
        },
        lastPreview: null,
        lastApply: null,
        lastVerify: null,
      };
      renderWithProviders(
        <OverviewScreen {...makeProps({ lifecycleState })} />
      );
      expect(screen.getByText(/saved computer/i)).toBeInTheDocument();
    });
  });

  describe('engine disconnected state', () => {
    it('applies disabled styling to flow cards when engine is disconnected', () => {
      renderWithProviders(
        <OverviewScreen {...makeProps({ engineConnected: false })} />
      );
      const captureCard = screen.getByTestId('flow-capture');
      expect(captureCard.className).toContain('opacity-60');
      expect(captureCard.className).toContain('cursor-not-allowed');
    });

    it('keeps cards interactive when engine is connected', () => {
      renderWithProviders(
        <OverviewScreen {...makeProps({ engineConnected: true })} />
      );
      const captureCard = screen.getByTestId('flow-capture');
      expect(captureCard.className).not.toContain('opacity-60');
      expect(captureCard.className).not.toContain('cursor-not-allowed');
    });
  });

  describe('no profiles state', () => {
    it('still renders flow selector when no profiles exist', () => {
      renderWithProviders(
        <OverviewScreen {...makeProps({ profiles: [], selectedProfile: '' })} />
      );
      // Capture card should always be available (doesn't need a profile)
      expect(screen.getByTestId('flow-capture')).toBeInTheDocument();
      // Setup card should also render (shows empty state when expanded)
      expect(screen.getByTestId('flow-setup')).toBeInTheDocument();
    });
  });
});
