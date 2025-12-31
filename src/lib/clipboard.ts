export async function copyText(text: string): Promise<void> {
  if (!text) {
    throw new Error('No text provided to copy');
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('Clipboard API not available');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Failed to copy to clipboard: ${message}`);
  }
}
