import type { EndstateError } from '../types';

/** Structured command-envelope failure passed through UI promise boundaries. */
export class EngineEnvelopeError extends Error {
  readonly code: string;
  readonly remediation: string | undefined;

  constructor(readonly engineError: EndstateError) {
    super(engineError.message);
    this.name = 'EngineEnvelopeError';
    this.code = engineError.code;
    this.remediation = engineError.remediation;
  }
}
