import { describe, expect, it } from 'vitest';

import { parseClaimIntent } from './claim-intent';

const TOKEN = 'A'.repeat(43);

describe('parseClaimIntent', () => {
  it('accepts the exact Endstate claim URL contract', () => {
    expect(parseClaimIntent(`endstate://claim?token=${TOKEN}`)).toEqual({
      type: 'claim',
      token: TOKEN,
    });
  });

  it.each([
    ['wrong scheme', `https://claim?token=${TOKEN}`],
    ['wrong host', `endstate://other?token=${TOKEN}`],
    ['path', `endstate://claim/setup?token=${TOKEN}`],
    ['root path', `endstate://claim/?token=${TOKEN}`],
    ['missing token', 'endstate://claim'],
    ['empty token', 'endstate://claim?token='],
    ['duplicate token', `endstate://claim?token=${TOKEN}&token=${TOKEN}`],
    ['extra query parameter', `endstate://claim?token=${TOKEN}&source=email`],
    ['fragment', `endstate://claim?token=${TOKEN}#finish`],
    ['empty fragment', `endstate://claim?token=${TOKEN}#`],
    ['credentials', `endstate://user:password@claim?token=${TOKEN}`],
    ['empty userinfo', `endstate://@claim?token=${TOKEN}`],
    ['port', `endstate://claim:42?token=${TOKEN}`],
    ['empty port', `endstate://claim:?token=${TOKEN}`],
    ['malformed encoding', `endstate://claim?token=%ZZ${'A'.repeat(40)}`],
    ['short token', `endstate://claim?token=${'A'.repeat(42)}`],
    ['long token', `endstate://claim?token=${'A'.repeat(44)}`],
    ['invalid token character', `endstate://claim?token=${'A'.repeat(42)}+`],
    ['trailing newline', `endstate://claim?token=${TOKEN}\n`],
    ['trailing CRLF', `endstate://claim?token=${TOKEN}\r\n`],
    ['trailing line separator', `endstate://claim?token=${TOKEN}\u2028`],
    ['trailing paragraph separator', `endstate://claim?token=${TOKEN}\u2029`],
    ['malformed URL', 'not a URL'],
  ])('rejects %s', (_case, url) => {
    expect(parseClaimIntent(url)).toBeNull();
  });

  it('accepts all base64url token characters', () => {
    const token = `${'a'.repeat(20)}${'Z'.repeat(20)}0_-`;

    expect(parseClaimIntent(`endstate://claim?token=${token}`)).toEqual({
      type: 'claim',
      token,
    });
  });
});
