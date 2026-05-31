import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import { AutoBackupSetting } from './auto-backup-setting';

describe('AutoBackupSetting', () => {
  it('reflects the enabled state', () => {
    renderWithProviders(<AutoBackupSetting enabled onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: /automatic cloud backup/i })).toBeChecked();
  });

  it('reflects the disabled state', () => {
    renderWithProviders(<AutoBackupSetting enabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole('switch', { name: /automatic cloud backup/i })).not.toBeChecked();
  });

  it('calls onChange with the toggled value', async () => {
    const onChange = vi.fn();
    renderWithProviders(<AutoBackupSetting enabled={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch', { name: /automatic cloud backup/i }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
