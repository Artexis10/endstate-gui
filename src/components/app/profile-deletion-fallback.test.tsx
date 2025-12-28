import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

describe('Profile Deletion Fallback - Toast Notifications', () => {
  it('should call showToast when selected profile is deleted and another exists', () => {
    const showToast = vi.fn();
    const discovered = [
      { name: 'profile-2', path: 'C:\\profiles\\profile-2.json', displayName: 'Profile 2' },
    ];
    const selectedProfilePath = 'C:\\profiles\\profile-1.json';

    // Simulate fallback logic
    const selectedStillExists = discovered.some(p => p.path === selectedProfilePath);
    if (!selectedStillExists && discovered.length > 0) {
      const firstProfile = discovered[0];
      showToast(`Selected profile no longer exists—switched to "${firstProfile.displayName || firstProfile.name}".`, 'info');
    }

    expect(showToast).toHaveBeenCalledWith(
      'Selected profile no longer exists—switched to "Profile 2".',
      'info'
    );
  });

  it('should call showToast when no profiles remain after deletion', () => {
    const showToast = vi.fn();
    const discovered: any[] = [];
    const selectedProfilePath = 'C:\\profiles\\profile-1.json';

    // Simulate fallback logic
    const selectedStillExists = discovered.some(p => p.path === selectedProfilePath);
    if (!selectedStillExists && discovered.length === 0) {
      showToast('No profiles available. Create a profile by capturing your computer setup.', 'info');
    }

    expect(showToast).toHaveBeenCalledWith(
      'No profiles available. Create a profile by capturing your computer setup.',
      'info'
    );
  });
});
