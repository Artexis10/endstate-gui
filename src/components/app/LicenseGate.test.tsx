import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

// Mock license module before imports
const mockCheckLicense = vi.fn();
const mockActivateLicense = vi.fn();

vi.mock('@/lib/license', () => ({
  checkLicense: (...args: unknown[]) => mockCheckLicense(...args),
  activateLicense: (...args: unknown[]) => mockActivateLicense(...args),
  deactivateLicense: vi.fn(),
}));

import { LicenseGate, useLicenseGate } from './LicenseGate';
import type { LicenseStatus } from '@/lib/license';

const ACTIVATED_STATUS: LicenseStatus = {
  activated: true,
  key: 'ABCD-1234-EFGH-5678',
  instanceId: 'inst-001',
  activatedAt: '2026-01-15T10:30:00Z',
  machineName: 'WIN-DESKTOP',
  validationError: null,
};

const NOT_ACTIVATED_STATUS: LicenseStatus = {
  activated: false,
  key: null,
  instanceId: null,
  activatedAt: null,
  machineName: null,
  validationError: null,
};

describe('LicenseGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders activation screen when not activated', async () => {
    mockCheckLicense.mockResolvedValue(NOT_ACTIVATED_STATUS);

    renderWithProviders(
      <LicenseGate>
        <div>App Content</div>
      </LicenseGate>
    );

    await waitFor(() => {
      expect(screen.getByText('Activate Endstate')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('License key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
    expect(screen.getByText('Buy Endstate')).toBeInTheDocument();
    expect(screen.queryByText('App Content')).not.toBeInTheDocument();
  });

  it('renders children when activated', async () => {
    mockCheckLicense.mockResolvedValue(ACTIVATED_STATUS);

    renderWithProviders(
      <LicenseGate>
        <div>App Content</div>
      </LicenseGate>
    );

    await waitFor(() => {
      expect(screen.getByText('App Content')).toBeInTheDocument();
    });

    expect(screen.queryByText('Activate Endstate')).not.toBeInTheDocument();
  });

  it('shows loading state while checking license', () => {
    // Never resolve — keeps component in checking state
    mockCheckLicense.mockReturnValue(new Promise(() => {}));

    renderWithProviders(
      <LicenseGate>
        <div>App Content</div>
      </LicenseGate>
    );

    expect(screen.queryByText('App Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Activate Endstate')).not.toBeInTheDocument();
  });

  it('shows activation screen when check_license fails', async () => {
    mockCheckLicense.mockRejectedValue(new Error('No license file'));

    renderWithProviders(
      <LicenseGate>
        <div>App Content</div>
      </LicenseGate>
    );

    await waitFor(() => {
      expect(screen.getByText('Activate Endstate')).toBeInTheDocument();
    });
  });

  describe('activation flow', () => {
    beforeEach(() => {
      mockCheckLicense.mockResolvedValue(NOT_ACTIVATED_STATUS);
    });

    it('activates with valid key and shows app', async () => {
      mockActivateLicense.mockResolvedValue(ACTIVATED_STATUS);
      const user = userEvent.setup();

      renderWithProviders(
        <LicenseGate>
          <div>App Content</div>
        </LicenseGate>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('License key')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('License key'), 'ABCD-1234-EFGH-5678');
      await user.click(screen.getByRole('button', { name: 'Activate' }));

      await waitFor(() => {
        expect(screen.getByText('App Content')).toBeInTheDocument();
      });
      expect(mockActivateLicense).toHaveBeenCalledWith('ABCD-1234-EFGH-5678');
    });

    it('trims whitespace from key input', async () => {
      mockActivateLicense.mockResolvedValue(ACTIVATED_STATUS);
      const user = userEvent.setup();

      renderWithProviders(
        <LicenseGate>
          <div>App Content</div>
        </LicenseGate>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('License key')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('License key'), '  ABCD-1234  ');
      await user.click(screen.getByRole('button', { name: 'Activate' }));

      expect(mockActivateLicense).toHaveBeenCalledWith('ABCD-1234');
    });

    it('displays error on failed activation', async () => {
      mockActivateLicense.mockResolvedValue({
        ...NOT_ACTIVATED_STATUS,
        validationError: 'Maximum activations reached',
      });
      const user = userEvent.setup();

      renderWithProviders(
        <LicenseGate>
          <div>App Content</div>
        </LicenseGate>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('License key')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('License key'), 'BAD-KEY');
      await user.click(screen.getByRole('button', { name: 'Activate' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Maximum activations reached');
      });

      expect(screen.queryByText('App Content')).not.toBeInTheDocument();
    });

    it('displays error on network failure', async () => {
      mockActivateLicense.mockRejectedValue(new Error('Network error'));
      const user = userEvent.setup();

      renderWithProviders(
        <LicenseGate>
          <div>App Content</div>
        </LicenseGate>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('License key')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('License key'), 'SOME-KEY');
      await user.click(screen.getByRole('button', { name: 'Activate' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error');
      });
    });

    it('disables button when key input is empty', async () => {
      renderWithProviders(
        <LicenseGate>
          <div>App Content</div>
        </LicenseGate>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled();
      });
    });

    it('clears error when typing', async () => {
      mockActivateLicense.mockResolvedValue({
        ...NOT_ACTIVATED_STATUS,
        validationError: 'Invalid key',
      });
      const user = userEvent.setup();

      renderWithProviders(
        <LicenseGate>
          <div>App Content</div>
        </LicenseGate>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('License key')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('License key'), 'BAD');
      await user.click(screen.getByRole('button', { name: 'Activate' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('License key'), 'X');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('LicenseGate context', () => {
    function StatusDisplay() {
      const ctx = useLicenseGate();
      if (!ctx) return <div>No license context</div>;
      return (
        <div>
          <span>Key: {ctx.status.key}</span>
          <button onClick={ctx.onDeactivated}>Deactivate</button>
        </div>
      );
    }

    it('provides license status to children', async () => {
      mockCheckLicense.mockResolvedValue(ACTIVATED_STATUS);

      renderWithProviders(
        <LicenseGate>
          <StatusDisplay />
        </LicenseGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Key: ABCD-1234-EFGH-5678')).toBeInTheDocument();
      });
    });

    it('returns to activation screen when onDeactivated is called', async () => {
      mockCheckLicense.mockResolvedValue(ACTIVATED_STATUS);
      const user = userEvent.setup();

      renderWithProviders(
        <LicenseGate>
          <StatusDisplay />
        </LicenseGate>
      );

      await waitFor(() => {
        expect(screen.getByText('Key: ABCD-1234-EFGH-5678')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Deactivate' }));

      await waitFor(() => {
        expect(screen.getByText('Activate Endstate')).toBeInTheDocument();
      });
    });
  });
});
