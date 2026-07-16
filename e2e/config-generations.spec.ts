import { test, expect } from '@playwright/test';
import { installTauriMock } from './helpers/tauri-mock';

test.describe('configuration generations', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await installTauriMock(page, {
      initialProfileFiles: ['C:\\test\\profiles\\generation-profile.jsonc'],
    });

    await page.addInitScript(() => {
      localStorage.setItem('test:endstate-gui-settings', JSON.stringify({
        dryRunEnabled: false,
        showDetails: true,
      }));
      (window as any).__CONFIG_GENERATION_APPLY_ARGS__ = null;

      const resolution = (overrides: Record<string, unknown>) => ({
        moduleId: 'apps.photoshop',
        configSetId: 'preferences',
        targetCandidates: [],
        reason: null,
        migrationPath: [],
        resolvedTargets: [],
        status: 'skipped',
        label: 'Engine compatibility result',
        message: 'Engine compatibility message',
        remediation: null,
        ...overrides,
      });

      const previewResolutions = [
        resolution({
          captureId: 'legacy-capture',
          resolution: 'legacy_unverified',
          label: 'Compatibility unknown',
          message: 'Engine legacy consent warning',
          remediation: 'Engine legacy remediation',
        }),
        resolution({
          captureId: 'ambiguous-1',
          sourceGeneration: 'photoshop-gen-25',
          sourceGenerationFingerprint: 'sha256:source-one',
          resolution: 'unknown',
          reason: 'ambiguous_target_instance',
          label: 'Choose the first target',
          message: 'Engine first ambiguity message',
          targetCandidates: [
            {
              id: 'photoshop-2025', moduleId: 'apps.photoshop', detectorId: 'photoshop-install',
              rawVersion: '26.0', normalizedVersion: '26.0.0', evidence: { type: 'registry' },
              targetGenerationFingerprint: 'sha256:photoshop-26',
              restoreModuleRevision: 'revision-restore',
            },
            {
              id: 'photoshop-2024', moduleId: 'apps.photoshop', detectorId: 'photoshop-install',
              rawVersion: '25.0', normalizedVersion: '25.0.0', evidence: { type: 'registry' },
              targetGenerationFingerprint: 'sha256:photoshop-25',
              restoreModuleRevision: 'revision-restore',
            },
          ],
        }),
        resolution({
          captureId: 'ambiguous-2',
          sourceGeneration: 'photoshop-gen-beta',
          resolution: 'unknown',
          reason: 'ambiguous_target_instance',
          label: 'Choose the second target',
          message: 'Engine second ambiguity message',
          targetCandidates: [
            {
              id: 'photoshop-beta', moduleId: 'apps.photoshop', detectorId: 'photoshop-install',
              rawVersion: '27.0-beta', normalizedVersion: '27.0.0-beta', evidence: { type: 'registry' },
              targetGenerationFingerprint: 'sha256:photoshop-beta',
              restoreModuleRevision: 'revision-restore',
            },
            {
              id: 'photoshop-stable', moduleId: 'apps.photoshop', detectorId: 'photoshop-install',
              rawVersion: '26.1', normalizedVersion: '26.1.0', evidence: { type: 'registry' },
              targetGenerationFingerprint: 'sha256:photoshop-stable',
              restoreModuleRevision: 'revision-restore',
            },
          ],
        }),
      ];

      (window as any).__ENDSTATE_MOCK_ENGINE__ = {
        runEndstateOnce: async (_settings: unknown, command: string) => {
          const envelope = command === 'capabilities'
            ? {
                success: true,
                data: {
                  commands: {
                    apply: { flags: ['--restore-target'] },
                  },
                },
              }
            : command === 'report'
              ? { success: true, data: { hasState: false } }
              : { success: true, data: {} };
          return {
            success: true,
            envelope,
            exitCode: 0,
            stdout: JSON.stringify(envelope),
            stderr: '',
          };
        },
        runEndstateStreaming: async (
          _settings: unknown,
          command: string,
          args: string[],
          _onEvent: Function,
          options?: { onNdjsonEvent?: (event: unknown) => void },
        ) => {
          if (command === 'capabilities') {
            return {
              exitCode: 0,
              envelope: {
                success: true,
                data: {
                  commands: {
                    apply: { flags: ['--restore-target'] },
                  },
                },
              },
              stdout: '',
              stderr: '',
            };
          }
          if (command === 'report') {
            return {
              exitCode: 0,
              envelope: { success: true, data: { hasState: false } },
              stdout: '',
              stderr: '',
            };
          }
          if (command === 'apply') {
            const isPreview = args.includes('--dry-run');
            if (!isPreview) {
              (window as any).__CONFIG_GENERATION_APPLY_ARGS__ = [...args];
              const events = [
                {
                  version: 1,
                  event: 'config-resolution',
                  runId: 'run-apply',
                  timestamp: '2026-07-16T00:00:00Z',
                  captureId: 'ambiguous-1',
                  moduleId: 'apps.photoshop',
                  configSetId: 'preferences',
                  targetCandidates: [],
                  resolution: 'migrate',
                  reason: null,
                  migrationPath: ['photoshop-gen-25', 'photoshop-gen-26'],
                  label: 'Engine migration selected',
                  message: 'Transient migration selected',
                  remediation: null,
                },
                {
                  version: 1,
                  event: 'config-migration',
                  runId: 'run-apply',
                  timestamp: '2026-07-16T00:00:01Z',
                  captureId: 'ambiguous-1',
                  configSetId: 'preferences',
                  stage: 'rollback',
                  status: 'completed',
                  reason: 'migration_validation_failed',
                  message: 'Transient rollback completed',
                  remediation: 'Transient retry advice',
                },
              ];
              for (const event of events) options?.onNdjsonEvent?.(event);
              await new Promise((resolve) => setTimeout(resolve, 300));
            }

            const finalResolutions = isPreview
              ? previewResolutions
              : [
                  resolution({
                    captureId: 'legacy-capture',
                    resolution: 'legacy_unverified',
                    status: 'restored',
                    label: 'Legacy settings restored',
                    message: 'Engine final legacy result',
                  }),
                  resolution({
                    captureId: 'ambiguous-1',
                    sourceGeneration: 'photoshop-gen-25',
                    targetGeneration: 'photoshop-gen-26',
                    resolution: 'migrate',
                    migrationPath: ['photoshop-gen-25', 'photoshop-gen-26'],
                    status: 'rolled_back',
                    label: 'Migration rolled back',
                    message: 'Engine final rollback result',
                    remediation: 'Engine final rollback remediation',
                  }),
                  resolution({
                    captureId: 'ambiguous-2',
                    resolution: 'direct',
                    targetInstanceId: 'photoshop-beta',
                    status: 'restored',
                    label: 'Target restored directly',
                    message: 'Engine final direct result',
                  }),
                ];

            return {
              exitCode: 0,
              envelope: {
                success: true,
                error: null,
                data: {
                  counts: {
                    installed: 1,
                    alreadyInstalled: 0,
                    failed: 0,
                    skippedFiltered: 0,
                  },
                  items: [],
                  actions: [{ id: 'photoshop', ref: 'Adobe.Photoshop', status: isPreview ? 'to_install' : 'installed' }],
                  restoreModulesAvailable: [{ id: 'photoshop', displayName: 'Adobe Photoshop' }],
                  configModuleMap: { 'Adobe.Photoshop': 'apps.photoshop' },
                  restoreSummary: isPreview
                    ? undefined
                    : { total: 3, restored: 2, skipped: 0, failed: 1, backupLocation: null },
                  configResolutions: finalResolutions,
                  configResolutionSummary: {
                    total: 3,
                    direct: isPreview ? 0 : 1,
                    migrate: isPreview ? 0 : 1,
                    incompatible: 0,
                    unknown: isPreview ? 2 : 0,
                    legacyUnverified: 1,
                    selected: isPreview ? 0 : 3,
                    skipped: 0,
                    failed: isPreview ? 0 : 1,
                  },
                },
              },
              stdout: '',
              stderr: '',
            };
          }
          return {
            exitCode: 0,
            envelope: { success: true, data: {} },
            stdout: '',
            stderr: '',
          };
        },
      };
    });

    await page.goto(baseURL || '/');
    await page.waitForLoadState('networkidle');
  });

  test('requires legacy consent, forwards explicit targets, and trusts the final envelope', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await page.locator('[data-testid="profile-card-generation-profile"]').click();
    await expect(page.getByText('Preview complete')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('radio', { name: 'Install apps and restore settings' }).click();
    const legacyConsent = page.getByRole('checkbox', { name: 'Adobe Photoshop' });
    await expect(legacyConsent).not.toBeChecked();
    await expect(page.getByText('Engine legacy consent warning')).toBeVisible();

    const firstResolution = page.locator('[data-testid="config-resolution-ambiguous-1"]');
    await firstResolution.getByRole('button', { name: 'Configuration details' }).click();
    await expect(firstResolution.getByText('photoshop-gen-25')).toBeVisible();
    await expect(firstResolution.getByText('sha256:source-one')).toBeVisible();

    await legacyConsent.click();
    const firstTarget = page.getByRole('combobox', { name: 'Target for ambiguous-1' });
    await expect(firstTarget).toHaveAttribute('data-placeholder');
    await firstTarget.click();
    await page.getByRole('option', { name: 'photoshop-2025 · 26.0' }).click();
    const secondTarget = page.getByRole('combobox', { name: 'Target for ambiguous-2' });
    await expect(secondTarget).toHaveAttribute('data-placeholder');
    await secondTarget.click();
    await page.getByRole('option', { name: 'photoshop-beta · 27.0-beta' }).click();

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.getByText('Transient rollback completed')).toBeVisible();
    await expect(page.getByText('Engine final rollback result')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('rolled_back')).toBeVisible();
    await expect(page.getByText('Transient rollback completed')).not.toBeVisible();

    const applyArgs = await page.evaluate(() => (window as any).__CONFIG_GENERATION_APPLY_ARGS__);
    expect(applyArgs).toEqual([
      '--profile',
      'C:\\test\\profiles\\generation-profile.jsonc',
      '--enable-restore',
      '--restore-filter',
      'photoshop',
      '--restore-target',
      'ambiguous-1=photoshop-2025',
      '--restore-target',
      'ambiguous-2=photoshop-beta',
    ]);
  });

  test('does not enable restore or invent target mappings while legacy consent is unchecked', async ({ page }) => {
    await page.locator('[data-testid="intent-setup"]').click();
    await page.locator('[data-testid="profile-card-generation-profile"]').click();
    await expect(page.getByText('Preview complete')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('radio', { name: 'Install apps and restore settings' }).click();

    await expect(page.getByRole('checkbox', { name: 'Adobe Photoshop' })).not.toBeChecked();
    await expect(page.getByRole('combobox', { name: 'Target for ambiguous-1' }))
      .toHaveAttribute('data-placeholder');
    await expect(page.getByRole('combobox', { name: 'Target for ambiguous-2' }))
      .toHaveAttribute('data-placeholder');

    await page.locator('[data-testid="setup-flow-apply"]').click();
    await expect(page.getByText('Engine final rollback result')).toBeVisible({ timeout: 10_000 });

    const applyArgs = await page.evaluate(() => (window as any).__CONFIG_GENERATION_APPLY_ARGS__);
    expect(applyArgs).toEqual([
      '--profile',
      'C:\\test\\profiles\\generation-profile.jsonc',
    ]);
  });
});
