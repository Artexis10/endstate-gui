/**
 * Account-delete modal — gates Confirm on exact email match.
 *
 * The engine `account delete --confirm` takes no email argument; the email
 * match is GUI-side friction (contract §12). This test pins that contract.
 */

import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { AccountDeleteModal } from './account-delete-modal';

describe('AccountDeleteModal', () => {
  it('Confirm stays disabled until typed email matches exactly', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <AccountDeleteModal
        open
        onOpenChange={vi.fn()}
        expectedEmail="user@example.com"
        onConfirm={onConfirm}
      />,
    );

    const confirm = screen.getByTestId('account-delete-confirm');
    const input = screen.getByTestId('account-delete-email-input');
    expect(confirm).toBeDisabled();

    await userEvent.type(input, 'user@example.co');
    expect(confirm).toBeDisabled();

    await userEvent.type(input, 'm');
    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Confirm is disabled when expectedEmail is empty', () => {
    renderWithProviders(
      <AccountDeleteModal
        open
        onOpenChange={vi.fn()}
        expectedEmail=""
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByTestId('account-delete-confirm')).toBeDisabled();
  });
});
