export type ClaimIntent = Readonly<{
  type: 'claim';
  token: string;
}>;

const CLAIM_URL_PATTERN = /^endstate:\/\/claim\?token=([A-Za-z0-9_-]{43})$/;

export function parseClaimIntent(value: string): ClaimIntent | null {
  const match = CLAIM_URL_PATTERN.exec(value);
  if (!match || match[0] !== value) {
    return null;
  }

  return { type: 'claim', token: match[1] };
}
