import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen, within } from '../../test/test-utils';
import { CommandWarningList } from './command-warning-list';

describe('CommandWarningList', () => {
  it('renders no warning region when warnings are absent or empty', () => {
    const view = renderWithProviders(<CommandWarningList />);

    expect(screen.queryByRole('region', { name: /warnings/i })).not.toBeInTheDocument();

    view.rerender(<CommandWarningList warnings={[]} />);

    expect(screen.queryByRole('region', { name: /warnings/i })).not.toBeInTheDocument();
  });

  it('preserves messages, order, duplicates, metadata, and unknown codes with advisory semantics', () => {
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
    expect(items[0]).toHaveTextContent('choco.community');
    expect(items[0]).toHaveTextContent('git.install');
    expect(items[0]).not.toHaveTextContent('Chocolatey');
    expect(items[1]).toHaveTextContent('Winget.MixedCase');
    expect(items[1]).toHaveTextContent('Vendor.Product+Preview');
    expect(screen.getAllByText(repeated.message, { exact: true })).toHaveLength(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders driver-only and ref-only context without inventing the absent field', () => {
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

    expect(within(items[0]).getByText('Driver: chocolatey', { exact: true })).toBeInTheDocument();
    expect(items[0]).not.toHaveTextContent('Ref:');
    expect(items[0]).not.toHaveTextContent('Vendor.Package+Preview');
    expect(within(items[1]).getByText('Ref: Vendor.Package+Preview', { exact: true })).toBeInTheDocument();
    expect(items[1]).not.toHaveTextContent('Driver:');
    expect(items[1]).not.toHaveTextContent('chocolatey');
  });
});
