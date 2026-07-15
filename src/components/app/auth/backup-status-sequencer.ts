export type BackupStatusRequestRole = 'session' | 'background';

export interface BackupStatusRequestToken {
  epoch: number;
  requestId: number;
  role: BackupStatusRequestRole;
  sessionGeneration: number;
  blockedBySession: boolean;
}

export class BackupStatusSequencer {
  private epoch = 0;
  private nextRequestId = 0;
  private latestSessionRequestId = 0;
  private latestBackgroundRequestId = 0;
  private activeSessionRequestId: number | null = null;
  private sessionGeneration = 0;

  begin(role: BackupStatusRequestRole): BackupStatusRequestToken {
    const requestId = ++this.nextRequestId;
    if (role === 'session') {
      this.sessionGeneration += 1;
      this.latestSessionRequestId = requestId;
      this.activeSessionRequestId = requestId;
    } else {
      this.latestBackgroundRequestId = requestId;
    }

    return {
      epoch: this.epoch,
      requestId,
      role,
      sessionGeneration: this.sessionGeneration,
      blockedBySession: role === 'background' && this.activeSessionRequestId !== null,
    };
  }

  invalidate(): void {
    this.epoch += 1;
    this.latestSessionRequestId = 0;
    this.latestBackgroundRequestId = 0;
    this.activeSessionRequestId = null;
    this.sessionGeneration += 1;
  }

  isCurrent(token: BackupStatusRequestToken): boolean {
    if (token.epoch !== this.epoch) return false;
    if (token.role === 'session') {
      return token.requestId === this.latestSessionRequestId;
    }
    return (
      !token.blockedBySession &&
      this.activeSessionRequestId === null &&
      token.sessionGeneration === this.sessionGeneration &&
      token.requestId === this.latestBackgroundRequestId
    );
  }

  finish(token: BackupStatusRequestToken): void {
    if (token.role === 'session' && this.activeSessionRequestId === token.requestId) {
      this.activeSessionRequestId = null;
    }
  }
}
