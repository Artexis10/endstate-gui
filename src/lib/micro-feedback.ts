import { useRef, useState, useCallback } from 'react';

export type FeedbackIntent = 'success' | 'warn' | 'error';

export interface FeedbackState {
  visible: boolean;
  message: string;
  intent: FeedbackIntent;
}

export interface TriggerOptions {
  message: string;
  intent: FeedbackIntent;
  duration?: number;
}

export function useMicroFeedback(defaultDuration = 1000) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({
    visible: false,
    message: '',
    intent: 'success',
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const trigger = useCallback(
    ({ message, intent, duration = defaultDuration }: TriggerOptions) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setFeedback({ visible: true, message, intent });

      timeoutRef.current = setTimeout(() => {
        setFeedback((prev) => ({ ...prev, visible: false }));
      }, duration);
    },
    [defaultDuration]
  );

  const triggerAsync = useCallback(
    async <T,>(
      asyncFn: () => Promise<T>,
      successMessage: string,
      errorMessage: string
    ): Promise<T | undefined> => {
      try {
        const result = await asyncFn();
        trigger({ message: successMessage, intent: 'success' });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : errorMessage;
        trigger({ message, intent: 'error' });
        return undefined;
      }
    },
    [trigger]
  );

  return {
    buttonRef,
    feedback,
    trigger,
    triggerAsync,
  };
}
