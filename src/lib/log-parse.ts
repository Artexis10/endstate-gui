/**
 * Parser for Autosuite capture output logs
 * Extracts counts, progress, and metadata from streaming log output
 */

export interface CaptureStats {
  succeeded: number;
  skipped: number;
  failed: number;
  outputPath: string;
  lastProcessedApp: string;
  processedCount: number;
}

/**
 * Parse capture logs to extract statistics and progress
 * Handles both human-readable summary lines and JSON envelope
 */
export function parseCaptureOutput(logs: string): CaptureStats {
  const stats: CaptureStats = {
    succeeded: 0,
    skipped: 0,
    failed: 0,
    outputPath: '',
    lastProcessedApp: '',
    processedCount: 0,
  };

  if (!logs) return stats;

  const lines = logs.split('\n');

  for (const line of lines) {
    // Parse summary line: "Summary: 62 succeeded, 8 skipped, 0 failed"
    const summaryMatch = line.match(/Summary:\s*(\d+)\s+succeeded,\s*(\d+)\s+skipped,\s*(\d+)\s+failed/i);
    if (summaryMatch) {
      stats.succeeded = parseInt(summaryMatch[1], 10);
      stats.skipped = parseInt(summaryMatch[2], 10);
      stats.failed = parseInt(summaryMatch[3], 10);
    }

    // Parse per-app lines: "[OK] Discord.Discord (driver: winget)"
    const appMatch = line.match(/\[(OK|SKIP|FAIL)\]\s+([^\s(]+)/i);
    if (appMatch) {
      const status = appMatch[1].toUpperCase();
      const appId = appMatch[2];
      stats.lastProcessedApp = appId;
      stats.processedCount++;

      // If no summary line yet, count from individual lines
      if (stats.succeeded === 0 && stats.skipped === 0 && stats.failed === 0) {
        if (status === 'OK') stats.succeeded++;
        else if (status === 'SKIP') stats.skipped++;
        else if (status === 'FAIL') stats.failed++;
      }
    }

    // Parse JSON envelope for outputPath
    if (line.includes('"outputPath"')) {
      try {
        const jsonMatch = line.match(/\{.*"outputPath".*\}/);
        if (jsonMatch) {
          const envelope = JSON.parse(jsonMatch[0]);
          if (envelope.data?.outputPath) {
            stats.outputPath = envelope.data.outputPath;
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // Alternative: Parse "Manifest saved to: <path>" line
    const savedMatch = line.match(/Manifest saved to:\s*(.+)/i);
    if (savedMatch && !stats.outputPath) {
      stats.outputPath = savedMatch[1].trim();
    }
  }

  return stats;
}
