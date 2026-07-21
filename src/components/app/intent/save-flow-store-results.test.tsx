import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../test/test-utils';
import type { CaptureWarning, EndstateCaptureData } from '@/types';
import { SaveFlow } from './save-flow';

const warnings: CaptureWarning[] = [
  {
    code: 'store_source_unavailable',
    message: 'store command failed',
    driver: 'winget',
    source: 'msstore',
  },
  {
    code: 'winget_source_unavailable',
    message: 'community source command failed',
    driver: 'winget',
    source: 'winget',
  },
  {
    code: 'store_version_unpinned',
    message: '2 Store apps captured without versions',
    driver: 'winget',
    source: 'msstore',
  },
];

describe('SaveFlow Store capture results', () => {
  it('preserves engine-supplied msstore identity without inferring it from IDs', async () => {
    renderWithProviders(
      <SaveFlow
        onBack={vi.fn()}
        engineConnected
        isRunning={false}
        captureStage={null}
        liveAppEvents={[]}
        onStartCapture={vi.fn().mockResolvedValue({
          count: 2,
          draftText: '{}',
          apps: [
            { id: '9WZDNCRFJ3PZ', name: 'Store App', source: 'msstore' },
            { id: '9FAKEWITHOUTSOURCE', name: 'Source-less App' },
          ],
          warnings: [],
        })}
        onSaveToFile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start scan' }));
    await waitFor(() => expect(screen.getByText('Scan complete')).toBeInTheDocument());

    expect(screen.getByText('Store App').closest('[data-capture-app]')).toHaveTextContent('Microsoft Store');
    expect(screen.getByText('Source-less App').closest('[data-capture-app]')).not.toHaveTextContent('Microsoft Store');
    expect(screen.getAllByLabelText('Source: Microsoft Store')).toHaveLength(1);
  });

  it('keeps successful results while rendering all source and portability warnings distinctly', async () => {
    const envelopeData: EndstateCaptureData = { warnings };
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
          apps: [{ id: 'Mozilla.Firefox', source: 'winget' }],
          warnings: envelopeData.warnings,
        })}
        onSaveToFile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start scan' }));
    await waitFor(() => expect(screen.getByText('Scan complete')).toBeInTheDocument());

    expect(screen.getByText('Microsoft Store apps could not be included in this capture.')).toBeInTheDocument();
    expect(screen.getByText('Community-repository apps could not be included in this capture.')).toBeInTheDocument();
    expect(screen.getByText('Affected Microsoft Store apps will restore to the latest available version rather than the exact captured version.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByTestId('save-flow-save-file')).toBeInTheDocument();
  });

  it('does not promote an unavailable optional backend to a primary capture warning', async () => {
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
          apps: [{ id: 'Mozilla.Firefox', source: 'winget' }],
          warnings: [
            {
              code: 'optional_driver_unavailable',
              message: 'Optional capture driver chocolatey is unavailable',
              driver: 'chocolatey',
            },
          ],
        })}
        onSaveToFile={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start scan' }));
    await waitFor(() => expect(screen.getByText('Scan complete')).toBeInTheDocument());

    expect(screen.queryByLabelText('Capture warnings')).not.toBeInTheDocument();
    expect(screen.queryByText('Optional capture driver chocolatey is unavailable')).not.toBeInTheDocument();
    expect(screen.getByText('Mozilla.Firefox')).toBeInTheDocument();
    expect(screen.getByTestId('save-flow-save-file')).toBeInTheDocument();
  });
});
