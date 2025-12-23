import { describe, it, expect } from 'vitest';
import { parseCaptureOutput } from './log-parse';

describe('parseCaptureOutput', () => {
  describe('summary line parsing', () => {
    it('should parse summary line with all counts', () => {
      const logs = 'Summary: 62 succeeded, 8 skipped, 0 failed';
      const result = parseCaptureOutput(logs);
      
      expect(result.succeeded).toBe(62);
      expect(result.skipped).toBe(8);
      expect(result.failed).toBe(0);
    });

    it('should parse summary line with different counts', () => {
      const logs = 'Summary: 5 succeeded, 2 skipped, 1 failed';
      const result = parseCaptureOutput(logs);
      
      expect(result.succeeded).toBe(5);
      expect(result.skipped).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should handle summary line case-insensitively', () => {
      const logs = 'SUMMARY: 10 SUCCEEDED, 3 SKIPPED, 0 FAILED';
      const result = parseCaptureOutput(logs);
      
      expect(result.succeeded).toBe(10);
      expect(result.skipped).toBe(3);
      expect(result.failed).toBe(0);
    });
  });

  describe('outputPath extraction', () => {
    it('should extract outputPath from JSON envelope', () => {
      const logs = `
Capture complete!
{"schemaVersion":"1.0","cliVersion":"0.0.0-dev+702adc6","command":"capture","timestampUtc":"2025-12-22T21:03:34.5380554Z","success":true,"data":{"isExample":null,"sanitized":false,"outputPath":"C:\\\\Users\\\\win-laptop\\\\Documents\\\\Autosuite\\\\Setups\\\\setup_2025-12-22_21-03-31.jsonc"},"error":null}
      `;
      const result = parseCaptureOutput(logs);
      
      expect(result.outputPath).toBe('C:\\Users\\win-laptop\\Documents\\Autosuite\\Setups\\setup_2025-12-22_21-03-31.jsonc');
    });

    it('should extract outputPath from "Manifest saved:" line', () => {
      const logs = '[OK]     Manifest saved: C:\\Users\\win-laptop\\Documents\\Autosuite\\Setups\\setup_2025-12-22_21-03-31.jsonc';
      const result = parseCaptureOutput(logs);
      
      expect(result.outputPath).toBe('C:\\Users\\win-laptop\\Documents\\Autosuite\\Setups\\setup_2025-12-22_21-03-31.jsonc');
    });

    it('should prefer JSON envelope over manifest saved line', () => {
      const logs = `
[OK]     Manifest saved: C:\\Users\\old\\path.jsonc
{"data":{"outputPath":"C:\\\\Users\\\\new\\\\path.jsonc"}}
      `;
      const result = parseCaptureOutput(logs);
      
      expect(result.outputPath).toBe('C:\\Users\\new\\path.jsonc');
    });
  });

  describe('per-app parsing', () => {
    it('should parse [OK] app lines with driver', () => {
      const logs = '[OK] Discord.Discord (driver: winget)';
      const result = parseCaptureOutput(logs);
      
      expect(result.apps).toHaveLength(1);
      expect(result.apps[0]).toEqual({
        id: 'Discord.Discord',
        status: 'ok',
        driver: 'winget',
      });
    });

    it('should parse [SKIP] app lines', () => {
      const logs = '[SKIP] SomeApp.Name (driver: chocolatey)';
      const result = parseCaptureOutput(logs);
      
      expect(result.apps).toHaveLength(1);
      expect(result.apps[0]).toEqual({
        id: 'SomeApp.Name',
        status: 'skip',
        driver: 'chocolatey',
      });
    });

    it('should parse [FAIL] app lines', () => {
      const logs = '[FAIL] FailedApp (driver: scoop)';
      const result = parseCaptureOutput(logs);
      
      expect(result.apps).toHaveLength(1);
      expect(result.apps[0]).toEqual({
        id: 'FailedApp',
        status: 'fail',
        driver: 'scoop',
      });
    });

    it('should parse app lines without driver', () => {
      const logs = '[OK] SimpleApp';
      const result = parseCaptureOutput(logs);
      
      expect(result.apps).toHaveLength(1);
      expect(result.apps[0]).toEqual({
        id: 'SimpleApp',
        status: 'ok',
        driver: undefined,
      });
    });

    it('should parse multiple app lines', () => {
      const logs = `
[OK] App1 (driver: winget)
[SKIP] App2 (driver: chocolatey)
[OK] App3
[FAIL] App4 (driver: scoop)
      `;
      const result = parseCaptureOutput(logs);
      
      expect(result.apps).toHaveLength(4);
      expect(result.apps[0].id).toBe('App1');
      expect(result.apps[1].id).toBe('App2');
      expect(result.apps[2].id).toBe('App3');
      expect(result.apps[3].id).toBe('App4');
    });
  });

  describe('lastProcessedApp extraction', () => {
    it('should track the last processed app', () => {
      const logs = `[OK] App1
[SKIP] App2
[OK] App3`;
      const result = parseCaptureOutput(logs);
      
      expect(result.lastProcessedApp).toBe('App3');
    });

    it('should update lastProcessedApp on each app line', () => {
      const logs1 = '[OK] FirstApp';
      const result1 = parseCaptureOutput(logs1);
      expect(result1.lastProcessedApp).toBe('FirstApp');
      
      const logs2 = `[OK] FirstApp
[SKIP] SecondApp`;
      const result2 = parseCaptureOutput(logs2);
      expect(result2.lastProcessedApp).toBe('SecondApp');
    });

    it('should update processedCount', () => {
      const logs = `[OK] App1
[SKIP] App2
[FAIL] App3`;
      const result = parseCaptureOutput(logs);
      
      expect(result.processedCount).toBe(3);
    });

    it('should increment processedCount on each app line', () => {
      const logs1 = '[OK] App1';
      const result1 = parseCaptureOutput(logs1);
      expect(result1.processedCount).toBe(1);
      
      const logs2 = `[OK] App1
[SKIP] App2
[OK] App3`;
      const result2 = parseCaptureOutput(logs2);
      expect(result2.processedCount).toBe(3);
    });
  });

  describe('full integration', () => {
    it('should parse complete capture output correctly', () => {
      const logs = `
[OK] Discord.Discord (driver: winget)
[OK] Google.Chrome (driver: winget)
[SKIP] OldApp (driver: chocolatey)
[OK]     Manifest saved: C:\\Users\\win-laptop\\Documents\\Autosuite\\Setups\\setup_2025-12-22_21-03-31.jsonc
Summary: 62 succeeded, 8 skipped, 0 failed
Capture complete!
{"schemaVersion":"1.0","cliVersion":"0.0.0-dev+702adc6","command":"capture","timestampUtc":"2025-12-22T21:03:34.5380554Z","success":true,"data":{"isExample":null,"sanitized":false,"outputPath":"C:\\\\Users\\\\win-laptop\\\\Documents\\\\Autosuite\\\\Setups\\\\setup_2025-12-22_21-03-31.jsonc"},"error":null}
      `;
      const result = parseCaptureOutput(logs);
      
      expect(result.succeeded).toBe(62);
      expect(result.skipped).toBe(8);
      expect(result.failed).toBe(0);
      expect(result.outputPath).toBe('C:\\Users\\win-laptop\\Documents\\Autosuite\\Setups\\setup_2025-12-22_21-03-31.jsonc');
      expect(result.apps).toHaveLength(3);
      expect(result.lastProcessedApp).toBe('OldApp');
      expect(result.processedCount).toBe(3);
    });
  });
});
