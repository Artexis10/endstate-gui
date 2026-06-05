import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '../../../test/test-utils';
import { BackupList } from './backup-list';
import type { BackupListItem } from '@/types';

const BACKUPS: BackupListItem[] = [
  {
    id: 'b-1',
    name: 'This computer',
    latestVersionId: 'v9',
    versionCount: 3,
    totalSize: 2048,
    updatedAt: '2026-06-01T00:00:00Z',
  },
];

const baseProps = {
  backups: BACKUPS,
  canWrite: true,
  canRestore: true,
  canDelete: true,
  onPush: vi.fn(),
  onRestore: vi.fn(),
  onDelete: vi.fn(),
  onSelect: vi.fn(),
  selectedBackupId: null,
};

describe('BackupList — rename affordance (gated on onRename)', () => {
  it('hides the rename action when onRename is not provided', () => {
    renderWithProviders(<BackupList {...baseProps} />);
    expect(screen.queryByTestId('backup-rename-b-1')).not.toBeInTheDocument();
  });

  it('shows the rename action and fires it with the backup id + current name', () => {
    const onRename = vi.fn();
    renderWithProviders(<BackupList {...baseProps} onRename={onRename} />);
    const btn = screen.getByTestId('backup-rename-b-1');
    fireEvent.click(btn);
    expect(onRename).toHaveBeenCalledWith('b-1', 'This computer');
  });

  it('does not select the row when the rename action is clicked', () => {
    const onRename = vi.fn();
    const onSelect = vi.fn();
    renderWithProviders(
      <BackupList {...baseProps} onSelect={onSelect} onRename={onRename} />,
    );
    fireEvent.click(screen.getByTestId('backup-rename-b-1'));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
