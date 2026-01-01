import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { CaptureResultModal } from './capture-result-modal';
import type { CapturedApp, CaptureCounts } from '../../types';

// Mock useShowDetails to control Details visibility in tests
vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(() => true), // Default to true so Details section renders
}));

/**
 * Test that raw app IDs with dots (e.g., Notepad++.Notepad++) display correctly
 * in Capture Details modal without being slugified to hyphens.
 */
describe('CaptureResultModal - Raw Dotted IDs', () => {
  const mockCounts: CaptureCounts = {
    totalFound: 3,
    included: 3,
    skipped: 0,
    filteredRuntimes: 0,
    filteredStoreApps: 0,
    sensitiveExcludedCount: 0,
  };

  const mockAppsWithDots: CapturedApp[] = [
    { id: 'Notepad++.Notepad++', source: 'winget' },
    { id: 'Git.Git', source: 'winget' },
    { id: 'Microsoft.VisualStudioCode', source: 'winget' },
  ];

  it('displays raw app IDs with dots exactly as stored (not slugified)', async () => {
    const user = userEvent.setup();
    
    render(
      <CaptureResultModal
        open={true}
        onClose={vi.fn()}
        counts={mockCounts}
        appsIncluded={mockAppsWithDots}
        outputPath="C:\\profiles\\test.jsonc"
      />
    );

    // Expand details section
    const detailsButton = screen.getByRole('button', { name: /details \(/i });
    await user.click(detailsButton);

    await waitFor(() => {
      expect(screen.getByText('winget')).toBeInTheDocument();
    });

    // Expand winget source
    const wingetButton = screen.getByText('winget').closest('button');
    await user.click(wingetButton!);

    // Verify raw dotted IDs are displayed exactly as stored
    await waitFor(() => {
      expect(screen.getByText('Notepad++.Notepad++')).toBeInTheDocument();
      expect(screen.getByText('Git.Git')).toBeInTheDocument();
      expect(screen.getByText('Microsoft.VisualStudioCode')).toBeInTheDocument();
    });

    // Ensure they are NOT slugified to hyphens
    expect(screen.queryByText('Notepad++-Notepad++')).not.toBeInTheDocument();
    expect(screen.queryByText('Git-Git')).not.toBeInTheDocument();
    expect(screen.queryByText('Microsoft-VisualStudioCode')).not.toBeInTheDocument();
  });

  it('search filters by raw dotted IDs when enableSearch is true', async () => {
    const user = userEvent.setup();
    
    render(
      <CaptureResultModal
        open={true}
        onClose={vi.fn()}
        counts={mockCounts}
        appsIncluded={mockAppsWithDots}
        outputPath="C:\\profiles\\test.jsonc"
        enableSearch={true}
      />
    );

    // Search input should be visible
    const searchInput = screen.getByPlaceholderText('Search apps...');
    expect(searchInput).toBeInTheDocument();

    // Search for "notepad++"
    await user.type(searchInput, 'notepad++');

    // Expand details
    const detailsButton = screen.getByRole('button', { name: /details \(/i });
    await user.click(detailsButton);

    // Should show filtered count
    expect(screen.getByText(/1 of 3 apps/i)).toBeInTheDocument();

    // Expand winget source
    const wingetButton = screen.getByText('winget').closest('button');
    await user.click(wingetButton!);

    // Only Notepad++ should be visible
    await waitFor(() => {
      expect(screen.getByText('Notepad++.Notepad++')).toBeInTheDocument();
    });
    expect(screen.queryByText('Git.Git')).not.toBeInTheDocument();
    expect(screen.queryByText('Microsoft.VisualStudioCode')).not.toBeInTheDocument();
  });
});
