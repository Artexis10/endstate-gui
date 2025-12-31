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
    
    expect(screen.getByText(/Profile:/)).toBeInTheDocument();
    expect(screen.getByText(/Test Profile/)).toBeInTheDocument();
  });

  it('shows app count prominently', async () => {
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
    
    // App count should be visible directly (apps-first design)
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Apps captured')).toBeInTheDocument();
    });
  });

  it('displays raw app IDs with dots preserved in main list', async () => {
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

    render(<ViewAppsModal {...defaultProps} />);
    
    // Apps should be visible directly in the main list (apps-first design)
    await waitFor(() => {
      expect(screen.getByText('Microsoft.VSCode')).toBeInTheDocument();
      expect(screen.getByText('Google.Chrome')).toBeInTheDocument();
      expect(screen.getByText('7zip.7zip')).toBeInTheDocument();
      expect(screen.getByText('Adobe.CreativeCloud')).toBeInTheDocument();
    });
  });

  it('displays app ID in main list', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({
      version: 1,
      apps: [
        { id: 'Microsoft.VSCode' },
      ],
    }));

    render(<ViewAppsModal {...defaultProps} />);
    
    // App should be visible directly
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
      expect(screen.getByText(/Test Profile/)).toBeInTheDocument();
    });
  });

  it('handles profile with no apps array', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue('{"version": 1}');

    render(<ViewAppsModal {...defaultProps} />);
    
    // Modal should still render
    await waitFor(() => {
      expect(screen.getByText(/Test Profile/)).toBeInTheDocument();
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
    
    // Wait for apps to load and search input to appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search apps...')).toBeInTheDocument();
      expect(screen.getByText('Microsoft.VSCode')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search apps...');
    await user.type(searchInput, 'chrome');

    // After filtering, only Chrome should be visible
    await waitFor(() => {
      expect(screen.queryByText('Microsoft.VSCode')).not.toBeInTheDocument();
      expect(screen.getByText('Google.Chrome')).toBeInTheDocument();
    });
  });

  it('shows Technical details accordion', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({
      version: 1,
      apps: [{ id: 'App.One' }],
    }));

    render(<ViewAppsModal {...defaultProps} />);
    
    // Technical details toggle should be present
    await waitFor(() => {
      expect(screen.getByText('Technical details')).toBeInTheDocument();
    });
  });
});
