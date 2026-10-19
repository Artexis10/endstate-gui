import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, within } from '../../test/test-utils';
import { CommandWarningList } from './command-warning-list';
import { useShowDetails } from '@/lib/use-show-details';

vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(() => false),
}));

describe('CommandWarningList', () => {
  beforeEach(() => {
    vi.mocked(useShowDetails).mockReturnValue(false);
  });

  it('renders no warning region when warnings are absent or empty', () => {
    const view = renderWithProviders(<CommandWarningList />);

    expect(screen.queryByRole('region', { name: /warnings/i })).not.toBeInTheDocument();

    view.rerender(<CommandWarningList warnings={[]} />);

    expect(screen.queryByRole('region', { name: /warnings/i })).not.toBeInTheDocument();
  });

  it('preserves messages, order, duplicates, and unknown codes with advisory semantics', () => {
    const repeated = {
      code: 'possible_duplicate',
      message: 'Possible duplicate: keep both entries until you decide.',
      driver: 'choco.community',
      ref: 'git.install',
    };
    const unknownMessage = 'Engine wording stays EXACTLY as supplied — punctuation included!';

    renderWithProviders(
      <CommandWarningList
        warnings={[
          repeated,
          {
            code: 'future_warning_code',
            message: unknownMessage,
            driver: 'Winget.MixedCase',
            ref: 'Vendor.Product+Preview',
          },
          repeated,
        ]}
      />,
    );

    const region = screen.getByRole('region', { name: /warnings/i });
    const list = within(region).getByRole('list');
    const items = within(list).getAllByRole('listitem');

    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText(repeated.message, { exact: true })).toBeInTheDocument();
    expect(within(items[1]).getByText(unknownMessage, { exact: true })).toBeInTheDocument();
    expect(within(items[2]).getByText(repeated.message, { exact: true })).toBeInTheDocument();
    expect(screen.getAllByText(repeated.message, { exact: true })).toHaveLength(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // Driver and package-ref jargon is technical detail. The default view must
  // show only the engine's message.
  it('keeps driver and ref out of the default view', () => {
    renderWithProviders(
      <CommandWarningList
        warnings={[{ code: 'possible_duplicate', message: 'Git is listed twice.', driver: 'chocolatey', ref: 'git.install' }]}
      />,
    );

    const item = within(screen.getByRole('list')).getByRole('listitem');
    expect(item).toHaveTextContent('Git is listed twice.');
    expect(item).not.toHaveTextContent('Driver:');
    expect(item).not.toHaveTextContent('git.install');
  });

  it('reveals driver and ref verbatim behind Details, without inventing an absent field', async () => {
    vi.mocked(useShowDetails).mockReturnValue(true);
    renderWithProviders(
      <CommandWarningList
        warnings={[
          {
            code: 'optional_driver_unavailable',
            message: 'Chocolatey is unavailable.',
            driver: 'chocolatey',
          },
          {
            code: 'package_advisory',
            message: 'Package-specific advisory.',
            ref: 'Vendor.Package+Preview',
          },
        ]}
      />,
    );

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items[0]).not.toHaveTextContent('Driver:');

    await userEvent.click(within(items[0]).getByRole('button', { name: 'Details' }));
    await userEvent.click(within(items[1]).getByRole('button', { name: 'Details' }));

    expect(within(items[0]).getByText('Driver: chocolatey', { exact: true })).toBeInTheDocument();
    expect(items[0]).not.toHaveTextContent('Ref:');
    expect(within(items[1]).getByText('Ref: Vendor.Package+Preview', { exact: true })).toBeInTheDocument();
    expect(items[1]).not.toHaveTextContent('Driver:');
  });
});
