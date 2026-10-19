import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor, within } from '../../../test/test-utils';
import { SaveFlow } from './save-flow';

describe('SaveFlow captured settings groups', () => {
  it('lists captured Windows settings under their own heading, not as settings without an app installer', async () => {
    renderWithProviders(
      <SaveFlow
        onBack={vi.fn()}
        engineConnected
        isRunning={false}
        captureStage={null}
        liveAppEvents={[]}
        onStartCapture={vi.fn().mockResolvedValue({
          count: 1,
          draftText: '{}',
          apps: [{ id: 'Vendor.Editor', name: 'Editor', source: 'winget' }],
          warnings: [],
          configModules: [
            {
              id: 'apps.dotfiles',
              appId: 'dotfiles',
              displayName: 'Shell dotfiles',
              status: 'captured',
              filesCaptured: 2,
              wingetRefs: [],
            },
            {
              id: 'windows-settings.taskbar',
              appId: 'windows-settings.taskbar',
              displayName: 'Windows taskbar: alignment',
              status: 'captured',
              filesCaptured: 1,
              wingetRefs: [],
            },
          ],
        })}
        onSaveToFile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start scan' }));
    await waitFor(() => expect(screen.getByText('Scan complete')).toBeInTheDocument());

    const settingsOnly = screen.getByTestId('config-only-section');
    expect(within(settingsOnly).getByText('Shell dotfiles')).toBeInTheDocument();
    expect(within(settingsOnly).queryByText('Windows taskbar: alignment')).not.toBeInTheDocument();

    const windowsSection = screen.getByTestId('captured-settings-windows');
    expect(within(windowsSection).getByText('Windows settings')).toBeInTheDocument();
    expect(within(windowsSection).getByText('Windows taskbar: alignment')).toBeInTheDocument();
  });
});
