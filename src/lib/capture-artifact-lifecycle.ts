export function shouldDeleteCaptureArtifact(
  isDevelopment: boolean,
  outputFormat: 'zip' | 'jsonc' | undefined,
): boolean {
  return !isDevelopment && outputFormat !== 'zip';
}
