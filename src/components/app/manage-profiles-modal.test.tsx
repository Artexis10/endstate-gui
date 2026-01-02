import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import '@testing-library/jest-dom/vitest';
import { ManageProfilesModal } from './manage-profiles-modal';
import type { DiscoveredProfile } from '@/file-discovery';
import { useShowDetails } from '@/lib/use-show-details';

// Mock the useShowDetails hook
vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(() => false), // Default to false
}));

/**
 * ManageProfilesModal UX Contract Tests
 * 
 * These tests verify:
 * - Selected profile cannot be deleted
 * - .meta.json files never appear as profiles (handled by discovery, not modal)
 * - Profile management actions are available
 */

describe('ManageProfilesModal', () => {
  const mockProfiles: DiscoveredProfile[] = [
    { name: 'profile-1', path: 'C:\\profiles\\profile-1.json', displayName: 'My First Profile' },
    { name: 'profile-2', path: 'C:\\profiles\\profile-2.jsonc', displayName: 'Second Profile' },
    { name: 'profile-3', path: 'C:\\profiles\\profile-3.json5' },
  ];

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    profiles: mockProfiles,
    selectedProfile: 'profile-1',
    profilesDirectory: 'C:\\profiles',
    onRenameDisplay: vi.fn(),
    onDelete: vi.fn(),
    onSetActive: vi.fn(),
    onOpenFolder: vi.fn(),
    onRefresh: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Selected profile protection', () => {
    it('disables delete button for selected profile', () => {
      render(<ManageProfilesModal {...defaultProps} selectedProfile="profile-1" />);
      
      // Find the row for profile-1 and check its delete button
      const rows = screen.getAllByRole('row');
      const profile1Row = rows.find(row => row.textContent?.includes('My First Profile'));
      expect(profile1Row).toBeDefined();
      
      // The delete button in this row should be disabled
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      const profile1DeleteBtn = deleteButtons[0]; // First profile's delete button
      expect(profile1DeleteBtn).toBeDisabled();
    });

    it('shows tooltip explaining why selected profile cannot be deleted', () => {
      render(<ManageProfilesModal {...defaultProps} selectedProfile="profile-1" />);
      
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      const profile1DeleteBtn = deleteButtons[0];
      
      expect(profile1DeleteBtn).toHaveAttribute('title', 'Select a different profile to delete this one');
    });

    it('enables delete button for non-selected profiles', () => {
      render(<ManageProfilesModal {...defaultProps} selectedProfile="profile-1" />);
      
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      // Second and third profiles should have enabled delete buttons
      expect(deleteButtons[1]).not.toBeDisabled();
      expect(deleteButtons[2]).not.toBeDisabled();
    });

    it('does not call onDelete when clicking disabled delete button', () => {
      render(<ManageProfilesModal {...defaultProps} selectedProfile="profile-1" />);
      
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      fireEvent.click(deleteButtons[0]); // Click disabled button
      
      expect(defaultProps.onDelete).not.toHaveBeenCalled();
    });

    it('calls onDelete when clicking enabled delete button', () => {
      render(<ManageProfilesModal {...defaultProps} selectedProfile="profile-1" />);
      
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      fireEvent.click(deleteButtons[1]); // Click second profile's delete button
      
      expect(defaultProps.onDelete).toHaveBeenCalledWith(
        'C:\\profiles\\profile-2.jsonc',
        'Second Profile'
      );
    });
  });

  describe('Profile display', () => {
    it('shows display name when available', () => {
      render(<ManageProfilesModal {...defaultProps} />);
      
      expect(screen.getByText('My First Profile')).toBeInTheDocument();
      expect(screen.getByText('Second Profile')).toBeInTheDocument();
    });

    it('shows filename as fallback when no display name', () => {
      render(<ManageProfilesModal {...defaultProps} />);
      
      // profile-3 has no displayName, should show name
      expect(screen.getByText('profile-3')).toBeInTheDocument();
    });

    it('shows "Active" badge for current profile', () => {
      render(<ManageProfilesModal {...defaultProps} selectedProfile="profile-1" />);
      
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('shows filename in secondary column when showDetails is ON', () => {
      vi.mocked(useShowDetails).mockReturnValue(true);
      render(<ManageProfilesModal {...defaultProps} />);
      
      expect(screen.getByText('profile-1.json')).toBeInTheDocument();
      expect(screen.getByText('profile-2.jsonc')).toBeInTheDocument();
      expect(screen.getByText('profile-3.json5')).toBeInTheDocument();
    });

    it('hides filename column when showDetails is OFF', () => {
      vi.mocked(useShowDetails).mockReturnValue(false);
      render(<ManageProfilesModal {...defaultProps} />);
      
      expect(screen.queryByText('profile-1.json')).not.toBeInTheDocument();
      expect(screen.queryByText('profile-2.jsonc')).not.toBeInTheDocument();
      expect(screen.queryByText('profile-3.json5')).not.toBeInTheDocument();
      expect(screen.queryByText('Filename')).not.toBeInTheDocument();
    });
  });

  describe('Header actions (showDetails ON)', () => {
    beforeEach(() => {
      vi.mocked(useShowDetails).mockReturnValue(true);
    });

    it('displays profiles directory path when showDetails is ON', () => {
      render(<ManageProfilesModal {...defaultProps} />);
      
      // The path is displayed - check for the label
      expect(screen.getByText('Profiles folder:')).toBeInTheDocument();
    });

    it('calls onOpenFolder when Open folder button is clicked', () => {
      render(<ManageProfilesModal {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /Open folder/i }));
      
      expect(defaultProps.onOpenFolder).toHaveBeenCalled();
    });

    it('calls onRefresh when Refresh button is clicked', async () => {
      render(<ManageProfilesModal {...defaultProps} />);
      
      fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
      
      expect(defaultProps.onRefresh).toHaveBeenCalled();
    });
  });

  describe('Header actions (showDetails OFF)', () => {
    beforeEach(() => {
      vi.mocked(useShowDetails).mockReturnValue(false);
    });

    it('hides profiles folder bar when showDetails is OFF', () => {
      render(<ManageProfilesModal {...defaultProps} />);
      
      // The folder bar should not be rendered
      expect(screen.queryByText('Profiles folder:')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Open folder/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Refresh/i })).not.toBeInTheDocument();
    });
  });

  describe('Rename actions', () => {
    it('calls onRenameDisplay when Rename button is clicked', () => {
      render(<ManageProfilesModal {...defaultProps} />);
      
      const renameButtons = screen.getAllByRole('button', { name: /^Rename$/i });
      fireEvent.click(renameButtons[0]);
      
      expect(defaultProps.onRenameDisplay).toHaveBeenCalledWith(
        'C:\\profiles\\profile-1.json',
        'My First Profile'
      );
    });
  });

  describe('Empty state', () => {
    it('shows message when no profiles exist', () => {
      render(<ManageProfilesModal {...defaultProps} profiles={[]} />);
      
      expect(screen.getByText('No profiles found')).toBeInTheDocument();
    });
  });

  describe('Details action', () => {
    it('shows Details button for each profile', () => {
      render(<ManageProfilesModal {...defaultProps} />);
      
      const detailsButtons = screen.getAllByRole('button', { name: /Details/i });
      expect(detailsButtons).toHaveLength(3); // One for each profile
    });
  });

  describe('Pending draft protection', () => {
    it('filters out pending draft from profiles list (does not appear)', () => {
      const pendingDraftPath = 'C:\\profiles\\profile-2.jsonc';
      render(
        <ManageProfilesModal
          {...defaultProps}
          selectedProfile="profile-1"
          pendingCaptureDraftPath={pendingDraftPath}
        />
      );
      
      // Per locked contract: drafts do NOT appear in Manage Profiles
      // Only 2 profiles should be visible (profile-1 and profile-3), not profile-2 (draft)
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      expect(deleteButtons).toHaveLength(2); // Only 2 profiles visible, not 3
    });

    it('draft is not visible in the list (filtered out)', () => {
      const pendingDraftPath = 'C:\\profiles\\profile-2.jsonc';
      render(
        <ManageProfilesModal
          {...defaultProps}
          selectedProfile="profile-1"
          pendingCaptureDraftPath={pendingDraftPath}
        />
      );
      
      // Draft should not appear in the list at all
      // We should only see profile-1 and profile-3
      expect(screen.queryByText('Second Profile')).not.toBeInTheDocument();
      expect(screen.getByText('My First Profile')).toBeInTheDocument();
      expect(screen.getByText('profile-3')).toBeInTheDocument();
    });

    it('shows all profiles when no draft exists', () => {
      render(
        <ManageProfilesModal
          {...defaultProps}
          selectedProfile="profile-1"
          pendingCaptureDraftPath={null}
        />
      );
      
      // All 3 profiles should be visible when there's no draft
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      expect(deleteButtons).toHaveLength(3);
    });

    it('enables delete for non-selected profiles when draft is filtered out', () => {
      const pendingDraftPath = 'C:\\profiles\\profile-2.jsonc';
      render(
        <ManageProfilesModal
          {...defaultProps}
          selectedProfile="profile-1"
          pendingCaptureDraftPath={pendingDraftPath}
        />
      );
      
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      // Only 2 profiles visible: profile-1 (selected, disabled) and profile-3 (enabled)
      expect(deleteButtons).toHaveLength(2);
      expect(deleteButtons[0]).toBeDisabled(); // selected profile-1
      expect(deleteButtons[1]).not.toBeDisabled(); // profile-3 (not selected)
    });

    it('allows deleting profile when no pending draft exists', () => {
      render(
        <ManageProfilesModal
          {...defaultProps}
          selectedProfile="profile-1"
          pendingCaptureDraftPath={null}
        />
      );
      
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
      // profile-2 should be enabled (not selected, no draft)
      expect(deleteButtons[1]).not.toBeDisabled();
      
      fireEvent.click(deleteButtons[1]);
      expect(defaultProps.onDelete).toHaveBeenCalledWith(
        'C:\\profiles\\profile-2.jsonc',
        'Second Profile'
      );
    });
  });
});
