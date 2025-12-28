import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ViewAppsModal } from './view-apps-modal';

// Mock the tauri-bridge
vi.mock('@/lib/tauri-bridge', () => ({
  invoke: vi.fn(),
}));

describe('ViewAppsModal', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    profilePath: 'C:\\profiles\\test.json',
    profileDisplayName: 'Test Profile',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays profile display name as title', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue('{"version": 1, "apps": []}');

    render(<ViewAppsModal {...defaultProps} />);
    
    expect(screen.getByText('Test Profile')).toBeInTheDocument();
  });

  it('shows app count from parsed manifest', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({
      version: 1,
      apps: [
        { id: 'App.One' },
        { id: 'App.Two' },
        { id: 'App.Three' },
      ],
    }));

    render(<ViewAppsModal {...defaultProps} />);
    
    // Expand details to see apps count
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toggle technical details/i })).toBeInTheDocument();
    });
    
    const detailsButton = screen.getByRole('button', { name: /toggle technical details/i });
    expect(detailsButton).toHaveTextContent('3 apps');
  });

  it('displays raw app IDs with dots preserved', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({
      version: 1,
      apps: [
        { id: 'Microsoft.VSCode' },
        { id: 'Google.Chrome' },
        { id: '7zip.7zip' },
        { id: 'Adobe.CreativeCloud' },
      ],
    }));

    const user = userEvent.setup();
    render(<ViewAppsModal {...defaultProps} />);
    
    // Expand details section
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toggle technical details/i })).toBeInTheDocument();
    });
    
    const detailsButton = screen.getByRole('button', { name: /toggle technical details/i });
    await user.click(detailsButton);
    
    // Expand winget source
    await waitFor(() => {
      expect(screen.getByText('winget')).toBeInTheDocument();
    });
    
    const wingetButton = screen.getByText('winget').closest('button');
    await user.click(wingetButton!);
    
    // Verify raw IDs with dots are displayed exactly as stored in manifest
    await waitFor(() => {
      expect(screen.getByText('Microsoft.VSCode')).toBeInTheDocument();
      expect(screen.getByText('Google.Chrome')).toBeInTheDocument();
      expect(screen.getByText('7zip.7zip')).toBeInTheDocument();
      expect(screen.getByText('Adobe.CreativeCloud')).toBeInTheDocument();
    });
  });

  it('displays app ID in details section', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({
      version: 1,
      apps: [
        { id: 'Microsoft.VSCode' },
      ],
    }));

    const user = userEvent.setup();
    render(<ViewAppsModal {...defaultProps} />);
    
    // Expand details
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toggle technical details/i })).toBeInTheDocument();
    });
    
    const detailsButton = screen.getByRole('button', { name: /toggle technical details/i });
    await user.click(detailsButton);
    
    // Expand winget source
    await waitFor(() => {
      expect(screen.getByText('winget')).toBeInTheDocument();
    });
    
    const wingetButton = screen.getByText('winget').closest('button');
    await user.click(wingetButton!);
    
    await waitFor(() => {
      expect(screen.getByText('Microsoft.VSCode')).toBeInTheDocument();
    });
  });

  it('handles parsing errors gracefully', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockRejectedValue(new Error('File not found'));

    render(<ViewAppsModal {...defaultProps} />);
    
    // Modal should still render with empty apps list
    await waitFor(() => {
      expect(screen.getByText('Test Profile')).toBeInTheDocument();
    });
  });

  it('handles profile with no apps array', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue('{"version": 1}');

    render(<ViewAppsModal {...defaultProps} />);
    
    // Modal should still render
    await waitFor(() => {
      expect(screen.getByText('Test Profile')).toBeInTheDocument();
    });
  });

  it('filters apps by search input', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({
      version: 1,
      apps: [
        { id: 'Microsoft.VSCode' },
        { id: 'Google.Chrome' },
      ],
    }));

    const user = userEvent.setup();
    render(<ViewAppsModal {...defaultProps} />);
    
    // Wait for search input to appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search apps...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search apps...');
    await user.type(searchInput, 'chrome');

    // Expand details to see filtered results
    const detailsButton = screen.getByRole('button', { name: /toggle technical details/i });
    await user.click(detailsButton);
    
    // Should show filtered count
    expect(detailsButton).toHaveTextContent('1 of 2 apps');
    
    // Expand winget source
    await waitFor(() => {
      expect(screen.getByText('winget')).toBeInTheDocument();
    });
    
    const wingetButton = screen.getByText('winget').closest('button');
    await user.click(wingetButton!);

    await waitFor(() => {
      expect(screen.queryByText('Microsoft.VSCode')).not.toBeInTheDocument();
      expect(screen.getByText('Google.Chrome')).toBeInTheDocument();
    });
  });
});
