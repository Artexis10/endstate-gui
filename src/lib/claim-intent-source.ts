import type { ClaimIntent } from './claim-intent';
import { parseClaimIntent } from './claim-intent';

export type ClaimIntentHandler = (intent: ClaimIntent) => void;
export type UnsubscribeClaimIntents = () => void;

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function subscribeToClaimIntents(
  onIntent: ClaimIntentHandler,
): Promise<UnsubscribeClaimIntents> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
  const consumeUrls = (urls: string[] | null): void => {
    for (const value of urls ?? []) {
      const intent = parseClaimIntent(value);
      if (intent) {
        onIntent(intent);
      }
    }
  };

  const unlisten = await onOpenUrl(consumeUrls);

  try {
    consumeUrls(await getCurrent());
  } catch (error) {
    unlisten();
    throw error;
  }

  return unlisten;
}
