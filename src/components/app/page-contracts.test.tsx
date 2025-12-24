import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/test-utils';
import '@testing-library/jest-dom/vitest';
import { PageHeader } from './page-header';

/**
 * Page-Level UX Contracts
 * 
 * These tests verify that each page has stable landmarks (headings)
 * that can be used for navigation verification and accessibility.
 * 
 * Full navigation flow testing is done in E2E tests (navigation-smoke.spec.ts).
 */

describe('Page-Level UX Contracts', () => {

  describe('PageHeader Component', () => {
    it('renders Apply page heading', () => {
      render(<PageHeader title="Set up computer" subtitle="Install apps from a saved setup profile" />);
      
      expect(screen.getByRole('heading', { name: 'Set up computer', level: 1 })).toBeInTheDocument();
      expect(screen.getByText('Install apps from a saved setup profile')).toBeInTheDocument();
    });

    it('renders Capture page heading', () => {
      render(<PageHeader title="Capture computer" subtitle="Create a reusable setup profile from this computer" />);
      
      expect(screen.getByRole('heading', { name: 'Capture computer', level: 1 })).toBeInTheDocument();
      expect(screen.getByText('Create a reusable setup profile from this computer')).toBeInTheDocument();
    });

    it('renders Verify page heading', () => {
      render(<PageHeader title="Check computer" subtitle="Checks whether this computer matches your setup. Does not make changes." />);
      
      expect(screen.getByRole('heading', { name: 'Check computer', level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/Checks whether this computer matches your setup/)).toBeInTheDocument();
    });

    it('renders Settings page heading', () => {
      render(<PageHeader title="Settings" subtitle="Configure endstate engine and preferences" />);
      
      expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
      expect(screen.getByText('Configure endstate engine and preferences')).toBeInTheDocument();
    });

    it('renders heading without subtitle', () => {
      render(<PageHeader title="Test Page" />);
      
      expect(screen.getByRole('heading', { name: 'Test Page', level: 1 })).toBeInTheDocument();
    });
  });
});
