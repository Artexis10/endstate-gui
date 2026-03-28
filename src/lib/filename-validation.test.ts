import { describe, it, expect } from 'vitest';
import {
  getExtension,
  getBasename,
  profileBasenameSchema,
  createProfileFilenameSchema,
  validateProfileFilename,
  VALID_EXTENSIONS,
} from './filename-validation';

describe('getExtension', () => {
  it('returns .json for .json file', () => {
    expect(getExtension('profile.json')).toBe('.json');
  });

  it('returns .jsonc for .jsonc file', () => {
    expect(getExtension('profile.jsonc')).toBe('.jsonc');
  });

  it('returns .json5 for .json5 file', () => {
    expect(getExtension('profile.json5')).toBe('.json5');
  });

  it('is case-insensitive', () => {
    expect(getExtension('profile.JSON')).toBe('.json');
    expect(getExtension('profile.JSONC')).toBe('.jsonc');
    expect(getExtension('profile.JSON5')).toBe('.json5');
  });

  it('defaults to .json when no recognized extension', () => {
    expect(getExtension('profile')).toBe('.json');
    expect(getExtension('profile.txt')).toBe('.json');
    expect(getExtension('profile.yaml')).toBe('.json');
  });

  it('matches the last valid extension in ambiguous filenames', () => {
    expect(getExtension('my.config.jsonc')).toBe('.jsonc');
  });
});

describe('getBasename', () => {
  it('removes .json extension', () => {
    expect(getBasename('profile.json')).toBe('profile');
  });

  it('removes .jsonc extension', () => {
    expect(getBasename('profile.jsonc')).toBe('profile');
  });

  it('removes .json5 extension', () => {
    expect(getBasename('profile.json5')).toBe('profile');
  });

  it('is case-insensitive for extension removal', () => {
    expect(getBasename('profile.JSON')).toBe('profile');
  });

  it('returns the full string when no recognized extension', () => {
    expect(getBasename('profile')).toBe('profile');
    expect(getBasename('profile.txt')).toBe('profile.txt');
  });

  it('only removes the final extension', () => {
    expect(getBasename('my.config.jsonc')).toBe('my.config');
  });
});

describe('VALID_EXTENSIONS', () => {
  it('contains .json, .jsonc, and .json5', () => {
    expect(VALID_EXTENSIONS).toEqual(['.json', '.jsonc', '.json5']);
  });
});

describe('profileBasenameSchema', () => {
  it('accepts valid basenames', () => {
    expect(profileBasenameSchema.safeParse('my-profile').success).toBe(true);
    expect(profileBasenameSchema.safeParse('my_profile').success).toBe(true);
    expect(profileBasenameSchema.safeParse('my profile').success).toBe(true);
    expect(profileBasenameSchema.safeParse('MyProfile123').success).toBe(true);
    expect(profileBasenameSchema.safeParse('a').success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = profileBasenameSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects strings over 115 characters', () => {
    const longName = 'a'.repeat(116);
    const result = profileBasenameSchema.safeParse(longName);
    expect(result.success).toBe(false);
  });

  it('accepts exactly 115 characters', () => {
    const maxName = 'a'.repeat(115);
    expect(profileBasenameSchema.safeParse(maxName).success).toBe(true);
  });

  it('rejects path separators', () => {
    expect(profileBasenameSchema.safeParse('path/name').success).toBe(false);
    expect(profileBasenameSchema.safeParse('path\\name').success).toBe(false);
    expect(profileBasenameSchema.safeParse('C:name').success).toBe(false);
  });

  it('rejects special characters', () => {
    expect(profileBasenameSchema.safeParse('name<>').success).toBe(false);
    expect(profileBasenameSchema.safeParse('name|pipe').success).toBe(false);
    expect(profileBasenameSchema.safeParse('name"quote').success).toBe(false);
    expect(profileBasenameSchema.safeParse('name?mark').success).toBe(false);
    expect(profileBasenameSchema.safeParse('name*star').success).toBe(false);
  });

  it('rejects trailing space', () => {
    const result = profileBasenameSchema.safeParse('name ');
    expect(result.success).toBe(false);
  });

  it('rejects trailing dot', () => {
    const result = profileBasenameSchema.safeParse('name.');
    expect(result.success).toBe(false);
  });

  it('rejects Windows reserved names', () => {
    expect(profileBasenameSchema.safeParse('CON').success).toBe(false);
    expect(profileBasenameSchema.safeParse('PRN').success).toBe(false);
    expect(profileBasenameSchema.safeParse('AUX').success).toBe(false);
    expect(profileBasenameSchema.safeParse('NUL').success).toBe(false);
    expect(profileBasenameSchema.safeParse('COM1').success).toBe(false);
    expect(profileBasenameSchema.safeParse('LPT1').success).toBe(false);
  });

  it('rejects Windows reserved names case-insensitively', () => {
    expect(profileBasenameSchema.safeParse('con').success).toBe(false);
    expect(profileBasenameSchema.safeParse('Con').success).toBe(false);
    expect(profileBasenameSchema.safeParse('nul').success).toBe(false);
  });

  it('allows dots in the middle', () => {
    expect(profileBasenameSchema.safeParse('my.profile').success).toBe(true);
  });
});

describe('createProfileFilenameSchema', () => {
  it('accepts valid filename with required extension', () => {
    const schema = createProfileFilenameSchema('.jsonc');
    expect(schema.safeParse('my-profile.jsonc').success).toBe(true);
  });

  it('rejects filename with wrong extension', () => {
    const schema = createProfileFilenameSchema('.jsonc');
    const result = schema.safeParse('my-profile.json');
    expect(result.success).toBe(false);
  });

  it('rejects empty filename', () => {
    const schema = createProfileFilenameSchema('.json');
    expect(schema.safeParse('').success).toBe(false);
  });

  it('rejects filename over 120 characters', () => {
    const schema = createProfileFilenameSchema('.json');
    const longName = 'a'.repeat(116) + '.json'; // 121 chars
    expect(schema.safeParse(longName).success).toBe(false);
  });

  it('rejects path separators in filename', () => {
    const schema = createProfileFilenameSchema('.json');
    expect(schema.safeParse('path/name.json').success).toBe(false);
  });

  it('rejects empty basename (just extension)', () => {
    const schema = createProfileFilenameSchema('.json');
    expect(schema.safeParse('.json').success).toBe(false);
  });

  it('rejects special characters in basename', () => {
    const schema = createProfileFilenameSchema('.json');
    expect(schema.safeParse('name<>.json').success).toBe(false);
  });

  it('rejects trailing space before extension', () => {
    const schema = createProfileFilenameSchema('.json');
    expect(schema.safeParse('name .json').success).toBe(false);
  });

  it('rejects trailing dot before extension', () => {
    const schema = createProfileFilenameSchema('.json');
    expect(schema.safeParse('name..json').success).toBe(false);
  });

  it('rejects Windows reserved basename', () => {
    const schema = createProfileFilenameSchema('.json');
    expect(schema.safeParse('CON.json').success).toBe(false);
    expect(schema.safeParse('nul.json').success).toBe(false);
  });

  it('works for all valid extensions', () => {
    for (const ext of VALID_EXTENSIONS) {
      const schema = createProfileFilenameSchema(ext);
      expect(schema.safeParse(`profile${ext}`).success).toBe(true);
    }
  });
});

describe('validateProfileFilename', () => {
  it('returns success for valid filename', () => {
    const result = validateProfileFilename('my-profile.jsonc', '.jsonc');
    expect(result).toEqual({ success: true, data: 'my-profile.jsonc' });
  });

  it('returns error for invalid filename', () => {
    const result = validateProfileFilename('', '.json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('returns error with message for wrong extension', () => {
    const result = validateProfileFilename('profile.json', '.jsonc');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('.jsonc');
    }
  });

  it('returns error for Windows reserved name', () => {
    const result = validateProfileFilename('CON.json', '.json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('reserved');
    }
  });

  it('returns error for path separators', () => {
    const result = validateProfileFilename('path/name.json', '.json');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('path separator');
    }
  });
});
