import { describe, expect, it } from 'vitest';
import { BackupStatusSequencer } from './backup-status-sequencer';

describe('BackupStatusSequencer', () => {
  it('rejects a pre-auth response after authentication advances the epoch', () => {
    const sequence = new BackupStatusSequencer();
    const startupRequest = sequence.begin('session');

    sequence.invalidate();
    const postAuthRequest = sequence.begin('session');

    expect(sequence.isCurrent(startupRequest)).toBe(false);
    expect(sequence.isCurrent(postAuthRequest)).toBe(true);
  });

  it('rejects a pre-logout response after logout advances the epoch', () => {
    const sequence = new BackupStatusSequencer();
    const signedInRefresh = sequence.begin('background');

    sequence.invalidate();
    const postLogoutRequest = sequence.begin('session');

    expect(sequence.isCurrent(signedInRefresh)).toBe(false);
    expect(sequence.isCurrent(postLogoutRequest)).toBe(true);
  });

  it('accepts only the newest session-defining request within one auth epoch', () => {
    const sequence = new BackupStatusSequencer();
    const older = sequence.begin('session');
    const newer = sequence.begin('session');

    expect(sequence.isCurrent(older)).toBe(false);
    expect(sequence.isCurrent(newer)).toBe(true);
  });

  it('keeps an older startup read effective when a newer background read fails', () => {
    const sequence = new BackupStatusSequencer();
    const startup = sequence.begin('session');
    const background = sequence.begin('background');

    expect(sequence.isCurrent(background)).toBe(false);
    sequence.finish(background);
    expect(sequence.isCurrent(startup)).toBe(true);
  });

  it('makes a newer session-defining read supersede an older background read', () => {
    const sequence = new BackupStatusSequencer();
    const background = sequence.begin('background');
    const session = sequence.begin('session');

    expect(sequence.isCurrent(background)).toBe(false);
    expect(sequence.isCurrent(session)).toBe(true);
    sequence.finish(session);
    expect(sequence.isCurrent(background)).toBe(false);
  });
});
