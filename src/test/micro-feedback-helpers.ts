import { vi } from 'vitest';

/**
 * Mock clipboard API for tests
 */
export function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  
  Object.assign(navigator, {
    clipboard: {
      writeText,
    },
  });
  
  return { writeText };
}

/**
 * Helper to verify feedback appears in the DOM
 * Use this with waitFor to check for feedback messages
 */
export function getFeedbackMessage(container: HTMLElement, message: string): HTMLElement | null {
  const feedbackElements = container.querySelectorAll('[role="status"]');
  for (const el of feedbackElements) {
    if (el.textContent?.includes(message)) {
      return el as HTMLElement;
    }
  }
  return null;
}

/**
 * Helper to wait for feedback to appear and disappear
 * Useful for testing the full feedback lifecycle
 */
export async function waitForFeedbackCycle(
  container: HTMLElement,
  message: string,
  timeout = 2000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let found = false;
    
    const checkInterval = setInterval(() => {
      const feedback = getFeedbackMessage(container, message);
      
      if (feedback && !found) {
        found = true;
      } else if (!feedback && found) {
        clearInterval(checkInterval);
        resolve();
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error(`Feedback cycle timeout for message: ${message}`));
      }
    }, 50);
  });
}
