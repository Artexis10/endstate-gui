import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/test-utils';
import '@testing-library/jest-dom/vitest';
import { PageHeader } from './page-header';

/**
 * PageHeader Component Tests
 * 
 * These tests verify that the PageHeader component renders correctly
 * with various title/subtitle combinations.
 */

describe('PageHeader Component', () => {
  it('renders heading with title and subtitle', () => {
    render(<PageHeader title="Settings" subtitle="Configure endstate engine and preferences" />);
    
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Configure endstate engine and preferences')).toBeInTheDocument();
  });

  it('renders heading without subtitle', () => {
    render(<PageHeader title="Test Page" />);
    
    expect(screen.getByRole('heading', { name: 'Test Page', level: 1 })).toBeInTheDocument();
  });
});
