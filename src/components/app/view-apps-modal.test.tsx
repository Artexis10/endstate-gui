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
    
    await waitFor(() => {
      expect(screen.getByText('3 apps in this profile')).toBeInTheDocument();
    });
  });

  it('displays app IDs in the list', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({
      version: 1,
      apps: [
        { id: 'Microsoft.VSCode' },
        { id: 'Google.Chrome' },
      ],
    }));

    render(<ViewAppsModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Microsoft.VSCode')).toBeInTheDocument();
      expect(screen.getByText('Google.Chrome')).toBeInTheDocument();
    });
  });

  it('displays app name when present', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({
      version: 1,
      apps: [
        { id: 'Microsoft.VSCode', name: 'Visual Studio Code' },
      ],
    }));

    render(<ViewAppsModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Visual Studio Code')).toBeInTheDocument();
      expect(screen.getByText('Microsoft.VSCode')).toBeInTheDocument();
    });
  });

  it('shows error state when parsing fails', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockRejectedValue(new Error('File not found'));

    render(<ViewAppsModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to parse profile/i)).toBeInTheDocument();
    });
  });

  it('shows error when profile has no apps array', async () => {
    const { invoke } = await import('@/lib/tauri-bridge');
    vi.mocked(invoke).mockResolvedValue('{"version": 1}');

    render(<ViewAppsModal {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText(/no apps array/i)).toBeInTheDocument();
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
    
    await waitFor(() => {
      expect(screen.getByText('Microsoft.VSCode')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search apps...');
    await user.type(searchInput, 'chrome');

    await waitFor(() => {
      expect(screen.queryByText('Microsoft.VSCode')).not.toBeInTheDocument();
      expect(screen.getByText('Google.Chrome')).toBeInTheDocument();
    });
  });
});
