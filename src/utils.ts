/**
 * Strip ANSI escape codes from text.
 * Removes color codes, cursor movements, and other terminal control sequences.
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}
