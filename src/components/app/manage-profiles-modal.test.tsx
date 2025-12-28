import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils';
import '@testing-library/jest-dom/vitest';
import { ManageProfilesModal } from './manage-profiles-modal';
import type { DiscoveredProfile } from '@/file-discovery';

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
    onRenameFile: vi.fn(),
    onDelete: vi.fn(),
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

    it('shows "Selected" badge for current profile', () => {
      render(<ManageProfilesModal {...defaultProps} selectedProfile="profile-1" />);
      
      expect(screen.getByText('Selected')).toBeInTheDocument();
    });

    it('shows filename in secondary column', () => {
      render(<ManageProfilesModal {...defaultProps} />);
      
      expect(screen.getByText('profile-1.json')).toBeInTheDocument();
      expect(screen.getByText('profile-2.jsonc')).toBeInTheDocument();
      expect(screen.getByText('profile-3.json5')).toBeInTheDocument();
    });
  });

  describe('Header actions', () => {
    it('displays profiles directory path', () => {
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
});
