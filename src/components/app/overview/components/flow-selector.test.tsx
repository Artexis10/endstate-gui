import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../../../../test/test-utils';
import { FlowSelector } from './flow-selector';
import type { DiscoveredProfile } from '@/file-discovery';

const profiles: DiscoveredProfile[] = [
  { name: 'work.jsonc', path: 'C:\\profiles\\work.jsonc', displayName: 'Work Setup' },
  { name: 'home.jsonc', path: 'C:\\profiles\\home.jsonc', displayName: 'Home Setup' },
];

function makeProps(overrides: Partial<Parameters<typeof FlowSelector>[0]> = {}) {
  return {
    activeFlow: 'none' as const,
    setActiveFlow: vi.fn(),
    profiles,
    selectedProfile: 'work.jsonc',
    hasProfile: true,
    engineConnected: true,
    isRunning: false,
    onProfileChange: vi.fn(),
    onOpenProfilesFolder: vi.fn(),
    onRefreshProfiles: vi.fn().mockResolvedValue(undefined),
    onManageProfiles: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
}

describe('FlowSelector', () => {
  describe('split view (activeFlow=none)', () => {
    it('renders both flow cards', () => {
      renderWithProviders(<FlowSelector {...makeProps()} />);
      expect(screen.getByTestId('flow-capture')).toBeInTheDocument();
      expect(screen.getByTestId('flow-setup')).toBeInTheDocument();
    });

    it('renders profile count for setup card', () => {
      renderWithProviders(<FlowSelector {...makeProps()} />);
      expect(screen.getByText('2 profiles available')).toBeInTheDocument();
    });

    it('renders singular "profile" for 1 profile', () => {
      renderWithProviders(
        <FlowSelector {...makeProps({ profiles: [profiles[0]] })} />
      );
      expect(screen.getByText('1 profile available')).toBeInTheDocument();
    });

    it('does not show profile count when no profiles', () => {
      renderWithProviders(
        <FlowSelector {...makeProps({ profiles: [] })} />
      );
      expect(screen.queryByText(/profiles? available/)).not.toBeInTheDocument();
    });

    it('calls setActiveFlow("capture") when capture card is clicked', () => {
      const setActiveFlow = vi.fn();
      renderWithProviders(
        <FlowSelector {...makeProps({ setActiveFlow })} />
      );
      fireEvent.click(screen.getByTestId('flow-capture'));
      expect(setActiveFlow).toHaveBeenCalledWith('capture');
    });

    it('calls setActiveFlow("setup") when setup card is clicked', () => {
      const setActiveFlow = vi.fn();
      renderWithProviders(
        <FlowSelector {...makeProps({ setActiveFlow })} />
      );
      fireEvent.click(screen.getByTestId('flow-setup'));
      expect(setActiveFlow).toHaveBeenCalledWith('setup');
    });

    it('does not call setActiveFlow when disabled (engine disconnected)', () => {
      const setActiveFlow = vi.fn();
      renderWithProviders(
        <FlowSelector {...makeProps({ setActiveFlow, engineConnected: false })} />
      );
      fireEvent.click(screen.getByTestId('flow-capture'));
      fireEvent.click(screen.getByTestId('flow-setup'));
      expect(setActiveFlow).not.toHaveBeenCalled();
    });

    it('does not call setActiveFlow when isRunning', () => {
      const setActiveFlow = vi.fn();
      renderWithProviders(
        <FlowSelector {...makeProps({ setActiveFlow, isRunning: true })} />
      );
      fireEvent.click(screen.getByTestId('flow-capture'));
      expect(setActiveFlow).not.toHaveBeenCalled();
    });

    it('activates capture via Enter key', () => {
      const setActiveFlow = vi.fn();
      renderWithProviders(
        <FlowSelector {...makeProps({ setActiveFlow })} />
      );
      fireEvent.keyDown(screen.getByTestId('flow-capture'), { key: 'Enter' });
      expect(setActiveFlow).toHaveBeenCalledWith('capture');
    });

    it('activates setup via Space key', () => {
      const setActiveFlow = vi.fn();
      renderWithProviders(
        <FlowSelector {...makeProps({ setActiveFlow })} />
      );
      fireEvent.keyDown(screen.getByTestId('flow-setup'), { key: ' ' });
      expect(setActiveFlow).toHaveBeenCalledWith('setup');
    });

    it('applies disabled styling when engine is disconnected', () => {
      renderWithProviders(
        <FlowSelector {...makeProps({ engineConnected: false })} />
      );
      const captureCard = screen.getByTestId('flow-capture');
      expect(captureCard.className).toContain('opacity-60');
      expect(captureCard.className).toContain('cursor-not-allowed');
    });
  });

  describe('capture expanded (activeFlow=capture)', () => {
    it('renders capture expanded view', () => {
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'capture' })} />
      );
      expect(screen.getByTestId('flow-capture-expanded')).toBeInTheDocument();
    });

    it('renders back button when not running', () => {
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'capture' })} />
      );
      expect(screen.getByTestId('flow-back-button')).toBeInTheDocument();
    });

    it('hides back button when running', () => {
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'capture', isRunning: true })} />
      );
      expect(screen.queryByTestId('flow-back-button')).not.toBeInTheDocument();
    });

    it('calls onBack when back button is clicked', () => {
      const onBack = vi.fn();
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'capture', onBack })} />
      );
      fireEvent.click(screen.getByTestId('flow-back-button'));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('renders captureActionSlot content', () => {
      renderWithProviders(
        <FlowSelector
          {...makeProps({ activeFlow: 'capture' })}
          captureActionSlot={<div data-testid="capture-slot">Capture content</div>}
        />
      );
      expect(screen.getByTestId('capture-slot')).toBeInTheDocument();
    });
  });

  describe('setup expanded (activeFlow=setup)', () => {
    it('renders setup expanded view with profile', () => {
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'setup' })} />
      );
      expect(screen.getByTestId('flow-setup-expanded')).toBeInTheDocument();
    });

    it('renders back button when not running', () => {
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'setup' })} />
      );
      expect(screen.getByTestId('flow-back-button')).toBeInTheDocument();
    });

    it('hides back button when running', () => {
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'setup', isRunning: true })} />
      );
      expect(screen.queryByTestId('flow-back-button')).not.toBeInTheDocument();
    });

    it('renders setupActionSlot when profile is selected', () => {
      renderWithProviders(
        <FlowSelector
          {...makeProps({ activeFlow: 'setup' })}
          setupActionSlot={<div data-testid="setup-slot">Setup content</div>}
        />
      );
      expect(screen.getByTestId('setup-slot')).toBeInTheDocument();
    });

    it('renders profile picker when no profile selected', () => {
      renderWithProviders(
        <FlowSelector
          {...makeProps({ activeFlow: 'setup', hasProfile: false })}
        />
      );
      expect(screen.getByTestId('flow-setup-profile-picker')).toBeInTheDocument();
    });

    it('renders empty state when no profiles and no selection', () => {
      renderWithProviders(
        <FlowSelector
          {...makeProps({ activeFlow: 'setup', hasProfile: false, profiles: [] })}
        />
      );
      expect(screen.getByTestId('flow-setup-empty')).toBeInTheDocument();
      expect(screen.getByText(/no setup profiles found/i)).toBeInTheDocument();
    });

    it('shows "Save this computer instead" link in empty state', () => {
      const setActiveFlow = vi.fn();
      renderWithProviders(
        <FlowSelector
          {...makeProps({ activeFlow: 'setup', hasProfile: false, profiles: [], setActiveFlow })}
        />
      );
      const captureLink = screen.getByText(/save this computer instead/i);
      fireEvent.click(captureLink);
      expect(setActiveFlow).toHaveBeenCalledWith('capture');
    });

    it('renders open profiles folder button in profile picker', () => {
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'setup', hasProfile: false })} />
      );
      expect(screen.getByRole('button', { name: /open profiles folder/i })).toBeInTheDocument();
    });

    it('calls onOpenProfilesFolder when button clicked in picker', () => {
      const onOpenProfilesFolder = vi.fn();
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'setup', hasProfile: false, onOpenProfilesFolder })} />
      );
      fireEvent.click(screen.getByRole('button', { name: /open profiles folder/i }));
      expect(onOpenProfilesFolder).toHaveBeenCalledTimes(1);
    });

    it('calls onRefreshProfiles when refresh button clicked', async () => {
      const onRefreshProfiles = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'setup', hasProfile: false, onRefreshProfiles })} />
      );
      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
      await waitFor(() => {
        expect(onRefreshProfiles).toHaveBeenCalledTimes(1);
      });
    });

    it('renders SelectedProfileCard when profile is selected', () => {
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'setup' })} />
      );
      expect(screen.getByTestId('current-profile-card-content')).toBeInTheDocument();
    });

    it('calls onOpenProfilesFolder in empty state', () => {
      const onOpenProfilesFolder = vi.fn();
      renderWithProviders(
        <FlowSelector {...makeProps({ activeFlow: 'setup', hasProfile: false, profiles: [], onOpenProfilesFolder })} />
      );
      fireEvent.click(screen.getByRole('button', { name: /open profiles folder/i }));
      expect(onOpenProfilesFolder).toHaveBeenCalledTimes(1);
    });
  });
});
