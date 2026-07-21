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

  it('handles non-Error throwables (string / unknown)', () => {
    expect(friendlyImportError('a.zip', 'boom')).toContain('a.zip');
    expect(friendlyImportError('b.zip', undefined)).toContain('b.zip');
    expect(friendlyImportError('c.zip', { weird: true })).toContain('c.zip');
  });
});
