import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../test/test-utils';
import { RenameBackupDialog } from './rename-backup-dialog';

function setup(overrides: Partial<React.ComponentProps<typeof RenameBackupDialog>> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  renderWithProviders(
    <RenameBackupDialog
      open
      currentName="This computer"
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      {...overrides}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe('RenameBackupDialog', () => {
  it('pre-fills the current name', () => {
    setup();
    expect(screen.getByLabelText('Backup name')).toHaveValue('This computer');
  });

  it('disables Save until the name actually changes', () => {
    setup();
    expect(screen.getByTestId('rename-backup-save')).toBeDisabled();
  });

  it('disables Save for a blank name', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Backup name'), { target: { value: '   ' } });
    expect(screen.getByTestId('rename-backup-save')).toBeDisabled();
  });

  it('confirms with the trimmed new name', () => {
    const { onConfirm } = setup();
    fireEvent.change(screen.getByLabelText('Backup name'), { target: { value: '  Gaming Rig  ' } });
    fireEvent.click(screen.getByTestId('rename-backup-save'));
    expect(onConfirm).toHaveBeenCalledWith('Gaming Rig');
  });

  it('does not confirm while busy', () => {
    const { onConfirm } = setup({ busy: true });
    fireEvent.change(screen.getByLabelText('Backup name'), { target: { value: 'New Name' } });
    expect(screen.getByTestId('rename-backup-save')).toBeDisabled();
    fireEvent.click(screen.getByTestId('rename-backup-save'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
