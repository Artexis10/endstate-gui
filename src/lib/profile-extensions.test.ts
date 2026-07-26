import { describe, it, expect } from 'vitest';
import {
  BUNDLE_DIALOG_EXTENSIONS,
  BUNDLE_EXTENSIONS,
  DEFAULT_BUNDLE_EXTENSION,
  PROFILE_DIALOG_EXTENSIONS,
  PROFILE_EXTENSIONS,
  isBundlePath,
  isManifestPath,
  isSupportedProfilePath,
} from './profile-extensions';

describe('bundle extensions', () => {
  it('writes .endstate by default and keeps .zip accepted', () => {
    expect(DEFAULT_BUNDLE_EXTENSION).toBe('.endstate');
    expect(BUNDLE_EXTENSIONS).toEqual(['.endstate', '.zip']);
  });

  it('offers dialog extensions without the leading dot, bundles first', () => {
    expect(BUNDLE_DIALOG_EXTENSIONS).toEqual(['endstate', 'zip']);
    expect(PROFILE_DIALOG_EXTENSIONS).toEqual([
      'endstate',
      'zip',
      'json',
      'jsonc',
      'json5',
    ]);
  });

  it('accepts every profile extension in the same order as the dot list', () => {
    expect(PROFILE_EXTENSIONS).toEqual([
      '.endstate',
      '.zip',
      '.json',
      '.jsonc',
      '.json5',
    ]);
  });
});

describe('isBundlePath', () => {
  it('matches .endstate case-insensitively', () => {
    expect(isBundlePath('capture.endstate')).toBe(true);
    expect(isBundlePath('CAPTURE.ENDSTATE')).toBe(true);
    expect(isBundlePath('C:\\Users\\me\\Capture.EndState')).toBe(true);
  });

  it('still matches the legacy .zip, permanently', () => {
    expect(isBundlePath('capture.zip')).toBe(true);
    expect(isBundlePath('CAPTURE.ZIP')).toBe(true);
    expect(isBundlePath('C:\\Users\\me\\Capture.Zip')).toBe(true);
  });

  it('ignores surrounding whitespace', () => {
    expect(isBundlePath('  capture.endstate  ')).toBe(true);
  });

  it('does not match a bundle extension buried inside a longer name', () => {
    expect(isBundlePath('capture.endstate.jsonc')).toBe(false);
    expect(isBundlePath('capture.zip.manifest.jsonc')).toBe(false);
  });

  it('does not match a bare extension word', () => {
    expect(isBundlePath('endstate')).toBe(false);
    expect(isBundlePath('zip')).toBe(false);
  });

  it('does not match manifests', () => {
    expect(isBundlePath('manifest.jsonc')).toBe(false);
  });
});

describe('isManifestPath', () => {
  it('matches the three manifest extensions case-insensitively', () => {
    expect(isManifestPath('manifest.json')).toBe(true);
    expect(isManifestPath('manifest.JSONC')).toBe(true);
    expect(isManifestPath('manifest.Json5')).toBe(true);
  });

  it('does not match bundles', () => {
    expect(isManifestPath('capture.endstate')).toBe(false);
    expect(isManifestPath('capture.zip')).toBe(false);
  });
});

describe('isSupportedProfilePath', () => {
  it('accepts bundles and manifests alike', () => {
    for (const name of [
      'a.endstate',
      'a.ENDSTATE',
      'a.zip',
      'a.json',
      'a.jsonc',
      'a.json5',
    ]) {
      expect(isSupportedProfilePath(name)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    for (const name of ['a.txt', 'a.exe', 'a', 'a.endstate.txt']) {
      expect(isSupportedProfilePath(name)).toBe(false);
    }
  });
});
