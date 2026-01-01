import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { DetailsDisclosure } from './details-disclosure';

// Mock the useShowDetails hook
vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(),
}));

describe('DetailsDisclosure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when showDetails setting is OFF', async () => {
    const { useShowDetails } = await import('@/lib/use-show-details');
    vi.mocked(useShowDetails).mockReturnValue(false);

    render(
      <DetailsDisclosure>
        <div data-testid="content">Secret content</div>
      </DetailsDisclosure>
    );

    // Nothing should be rendered
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('renders disclosure button when showDetails setting is ON', async () => {
    const { useShowDetails } = await import('@/lib/use-show-details');
    vi.mocked(useShowDetails).mockReturnValue(true);

    render(
      <DetailsDisclosure>
        <div data-testid="content">Secret content</div>
      </DetailsDisclosure>
    );

    // Button should be visible with default title
    expect(screen.getByText('Details')).toBeInTheDocument();
    // Content should be hidden initially
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('uses custom title when provided', async () => {
    const { useShowDetails } = await import('@/lib/use-show-details');
    vi.mocked(useShowDetails).mockReturnValue(true);

    render(
      <DetailsDisclosure title="Custom Title">
        <div>Content</div>
      </DetailsDisclosure>
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.queryByText('Details')).not.toBeInTheDocument();
  });

  it('expands to show content when clicked', async () => {
    const { useShowDetails } = await import('@/lib/use-show-details');
    vi.mocked(useShowDetails).mockReturnValue(true);

    const user = userEvent.setup();
    render(
      <DetailsDisclosure>
        <div data-testid="content">Secret content</div>
      </DetailsDisclosure>
    );

    // Content hidden initially
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();

    // Click to expand
    await user.click(screen.getByText('Details'));

    // Content should now be visible
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });

  it('collapses content when clicked again', async () => {
    const { useShowDetails } = await import('@/lib/use-show-details');
    vi.mocked(useShowDetails).mockReturnValue(true);

    const user = userEvent.setup();
    render(
      <DetailsDisclosure>
        <div data-testid="content">Secret content</div>
      </DetailsDisclosure>
    );

    // Expand
    await user.click(screen.getByText('Details'));
    expect(screen.getByTestId('content')).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByText('Details'));
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('starts expanded when defaultExpanded is true', async () => {
    const { useShowDetails } = await import('@/lib/use-show-details');
    vi.mocked(useShowDetails).mockReturnValue(true);

    render(
      <DetailsDisclosure defaultExpanded>
        <div data-testid="content">Secret content</div>
      </DetailsDisclosure>
    );

    // Content should be visible immediately
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('applies custom className', async () => {
    const { useShowDetails } = await import('@/lib/use-show-details');
    vi.mocked(useShowDetails).mockReturnValue(true);

    const { container } = render(
      <DetailsDisclosure className="custom-class">
        <div>Content</div>
      </DetailsDisclosure>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
