import { describe, it, expect } from 'vitest';
import { friendlyImportError } from './import-errors';

describe('friendlyImportError', () => {
  it('maps a bridge 413 (oversize bundle) to friendly copy without raw jargon', () => {
    // This is exactly what the dev HTTP bridge throws when a large capture zip
    // exceeds axum's body limit — the reproduced silent-import failure.
    const err = new Error('HTTP bridge error: 413 Payload Too Large');
    const msg = friendlyImportError('large-capture.zip', err);

    expect(msg).toContain('large-capture.zip');
    expect(msg).toMatch(/too large/i);
    // No transport/HTTP jargon leaks through.
    expect(msg).not.toMatch(/413/);
    expect(msg).not.toMatch(/payload too large/i);
    expect(msg).not.toMatch(/http bridge/i);
  });

  it('maps the axum "length limit exceeded" body error to oversize copy', () => {
    const err = new Error('Failed to buffer the request body: length limit exceeded');
    const msg = friendlyImportError('bundle.zip', err);

    expect(msg).toMatch(/too large/i);
    expect(msg).not.toMatch(/length limit exceeded/i);
    expect(msg).not.toMatch(/buffer the request body/i);
  });

  it('never surfaces raw Tauri invoke jargon', () => {
    const err = new Error(
      "Tauri invoke failed for 'import_zip_from_base64': something internal",
    );
    const msg = friendlyImportError('setup.zip', err);

    expect(msg).toContain('setup.zip');
    expect(msg).not.toMatch(/tauri invoke failed/i);
    expect(msg).not.toMatch(/import_zip_from_base64/i);
  });

  it('shows a short, clean engine message when one is available', () => {
    const err = new Error('Zip file does not exist');
    const msg = friendlyImportError('missing.zip', err);

    expect(msg).toContain('missing.zip');
    expect(msg).toContain('Zip file does not exist');
  });

  it('falls back to generic copy for multi-line or oversized blobs', () => {
    const err = new Error('line one\nline two\nstack trace...');
    const msg = friendlyImportError('weird.zip', err);

    expect(msg).toContain('weird.zip');
    expect(msg).not.toContain('\n');
    expect(msg).toMatch(/damaged|unexpected format/i);
  });

  it('surfaces the real reason hidden behind the Tauri invoke wrapper', () => {
    // Regression: the bridge wraps every backend error, and treating the whole
    // string as jargon threw the reason away with the wrapper. A stale
    // payloadRoot rule rejected every bundle captured by engine 2.27.5 and all
    // the user ever saw was "Please try again".
    const err = new Error(
      "Tauri invoke failed for 'extract_zip_profile': legacyConfigLanes[0].payloadRoot " +
        '"configs/inkscape-03d562e8" must be a single directory under configs/',
    );
    const msg = friendlyImportError('endstate-capture.zip', err);

    expect(msg).toContain('endstate-capture.zip');
    expect(msg).toContain('payloadRoot');
    expect(msg).toContain('configs/inkscape-03d562e8');
    // The wrapper itself still never leaks.
    expect(msg).not.toMatch(/tauri invoke failed/i);
    expect(msg).not.toMatch(/extract_zip_profile/i);
    expect(msg).not.toContain('\n');
  });

  it('stays generic when the wrapper hides nothing useful', () => {
    const err = new Error("Tauri invoke failed for 'extract_zip_profile': ");
    const msg = friendlyImportError('setup.zip', err);

    expect(msg).toMatch(/please try again/i);
    expect(msg).not.toMatch(/tauri invoke failed/i);
  });

  it('stays generic when the unwrapped message is itself transport plumbing', () => {
    const err = new Error(
      "Tauri invoke failed for 'extract_zip_profile': Tauri listen failed for 'endstate://event'",
    );
    const msg = friendlyImportError('setup.zip', err);

    expect(msg).toMatch(/please try again/i);
    expect(msg).not.toMatch(/tauri listen failed/i);
  });

  it('still reports oversize when the 413 arrives wrapped', () => {
    const err = new Error(
      "Tauri invoke failed for 'import_zip_from_base64': HTTP bridge error: 413 Payload Too Large",
    );
    const msg = friendlyImportError('big.zip', err);

    expect(msg).toMatch(/too large/i);
    expect(msg).not.toMatch(/413/);
    expect(msg).not.toMatch(/tauri invoke failed/i);
  });

  it('handles non-Error throwables (string / unknown)', () => {
    expect(friendlyImportError('a.zip', 'boom')).toContain('a.zip');
    expect(friendlyImportError('b.zip', undefined)).toContain('b.zip');
    expect(friendlyImportError('c.zip', { weird: true })).toContain('c.zip');
  });
});
