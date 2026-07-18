import { describe, expect, it } from 'vitest';
import { EngineEnvelopeError } from './engine-envelope-error';

describe('EngineEnvelopeError', () => {
  it('preserves engine message and remediation verbatim', () => {
    const error = new EngineEnvelopeError({
      code: 'INVALID_RESTORE_TARGET',
      message: 'Choose one of the detected targets.',
      remediation: 'Preview again and select another target.',
    });

    expect(error.message).toBe('Choose one of the detected targets.');
    expect(error.code).toBe('INVALID_RESTORE_TARGET');
    expect(error.remediation).toBe('Preview again and select another target.');
  });
});
