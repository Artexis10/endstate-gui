import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { QuotaMeter } from './quota-meter';

describe('QuotaMeter', () => {
  it('renders nothing when quotaTotalBytes is missing', () => {
    const { container } = renderWithProviders(
      <QuotaMeter quotaUsedBytes={1024} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when quotaTotalBytes is zero', () => {
    const { container } = renderWithProviders(
      <QuotaMeter quotaUsedBytes={0} quotaTotalBytes={0} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders normal tone under 50%', () => {
    renderWithProviders(
      <QuotaMeter quotaUsedBytes={100 * 1024 * 1024} quotaTotalBytes={1024 * 1024 * 1024} />,
    );
    expect(screen.getByTestId('quota-meter')).toHaveAttribute('data-tone', 'normal');
  });

  it('switches to warn at 50%', () => {
    renderWithProviders(
      <QuotaMeter quotaUsedBytes={600 * 1024 * 1024} quotaTotalBytes={1024 * 1024 * 1024} />,
    );
    expect(screen.getByTestId('quota-meter')).toHaveAttribute('data-tone', 'warn');
  });

  it('switches to danger at 90%', () => {
    renderWithProviders(
      <QuotaMeter quotaUsedBytes={950 * 1024 * 1024} quotaTotalBytes={1024 * 1024 * 1024} />,
    );
    expect(screen.getByTestId('quota-meter')).toHaveAttribute('data-tone', 'danger');
  });

  it('shows the version count when provided', () => {
    renderWithProviders(
      <QuotaMeter
        quotaUsedBytes={100}
        quotaTotalBytes={1024 * 1024}
        versionCount={3}
      />,
    );
    expect(screen.getByTestId('quota-meter')).toHaveTextContent(/3\/5 versions/);
  });

  it('omits the version count when undefined', () => {
    renderWithProviders(
      <QuotaMeter quotaUsedBytes={100} quotaTotalBytes={1024 * 1024} />,
    );
    expect(screen.getByTestId('quota-meter')).not.toHaveTextContent(/version/);
  });

  it('clamps progressbar at 100% when over quota', () => {
    renderWithProviders(
      <QuotaMeter quotaUsedBytes={2 * 1024 * 1024 * 1024} quotaTotalBytes={1024 * 1024 * 1024} />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('treats missing quotaUsedBytes as zero', () => {
    renderWithProviders(<QuotaMeter quotaTotalBytes={1024 * 1024} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });
});
