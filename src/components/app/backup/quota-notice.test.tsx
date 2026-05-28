import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { formatBytes } from '@/lib/format-bytes';
import { QuotaNotice } from './quota-notice';

describe('QuotaNotice', () => {
  it('renders nothing when quotaTotalBytes is missing', () => {
    const { container } = renderWithProviders(
      <QuotaNotice quotaUsedBytes={1024} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when quotaTotalBytes is zero', () => {
    const { container } = renderWithProviders(
      <QuotaNotice quotaUsedBytes={0} quotaTotalBytes={0} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing under 50% (normal tone)', () => {
    const { container } = renderWithProviders(
      <QuotaNotice
        quotaUsedBytes={100 * 1024 * 1024}
        quotaTotalBytes={1024 * 1024 * 1024}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders warn at exactly 50% with the exact copy', () => {
    const used = 512 * 1024 * 1024;
    const total = 1024 * 1024 * 1024;
    renderWithProviders(
      <QuotaNotice quotaUsedBytes={used} quotaTotalBytes={total} />,
    );
    const notice = screen.getByTestId('quota-notice');
    expect(notice).toHaveAttribute('data-tone', 'warn');
    expect(notice).toHaveTextContent(
      `Backup storage at 50% — using ${formatBytes(used)} of ${formatBytes(total)}. Delete older versions to free space.`,
    );
  });

  it('renders warn at 89%', () => {
    renderWithProviders(<QuotaNotice quotaUsedBytes={89} quotaTotalBytes={100} />);
    const notice = screen.getByTestId('quota-notice');
    expect(notice).toHaveAttribute('data-tone', 'warn');
    expect(notice).toHaveTextContent(/Backup storage at 89%/);
  });

  it('renders danger at exactly 90% with the exact copy', () => {
    const used = 900;
    const total = 1000;
    renderWithProviders(
      <QuotaNotice quotaUsedBytes={used} quotaTotalBytes={total} />,
    );
    const notice = screen.getByTestId('quota-notice');
    expect(notice).toHaveAttribute('data-tone', 'danger');
    expect(notice).toHaveTextContent(
      `Backup storage almost full (90%) — using ${formatBytes(used)} of ${formatBytes(total)}. Delete versions or upgrade to keep backing up.`,
    );
  });

  it('renders danger at 100%', () => {
    renderWithProviders(
      <QuotaNotice quotaUsedBytes={1000} quotaTotalBytes={1000} />,
    );
    const notice = screen.getByTestId('quota-notice');
    expect(notice).toHaveAttribute('data-tone', 'danger');
    expect(notice).toHaveTextContent(/\(100%\)/);
  });

  it('renders danger over 100% with the percent clamped', () => {
    renderWithProviders(
      <QuotaNotice quotaUsedBytes={2000} quotaTotalBytes={1000} />,
    );
    const notice = screen.getByTestId('quota-notice');
    expect(notice).toHaveAttribute('data-tone', 'danger');
    expect(notice).toHaveTextContent(/\(100%\)/);
  });

  it('sets role="status" and aria-live="polite" for screen reader transitions', () => {
    renderWithProviders(
      <QuotaNotice quotaUsedBytes={900} quotaTotalBytes={1000} />,
    );
    const notice = screen.getByTestId('quota-notice');
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-live', 'polite');
  });

  it('includes formatBytes output for used and total in the description', () => {
    const used = 512 * 1024 * 1024;
    const total = 1024 * 1024 * 1024;
    renderWithProviders(
      <QuotaNotice quotaUsedBytes={used} quotaTotalBytes={total} />,
    );
    const notice = screen.getByTestId('quota-notice');
    expect(notice).toHaveTextContent(formatBytes(used));
    expect(notice).toHaveTextContent(formatBytes(total));
  });
});
