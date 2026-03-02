import { invoke } from '@/lib/tauri-bridge';

export type LicenseStatus = {
  activated: boolean;
  key: string | null;
  instanceId: string | null;
  activatedAt: string | null;
  machineName: string | null;
  validationError: string | null;
};

export async function activateLicense(key: string): Promise<LicenseStatus> {
  return invoke<LicenseStatus>('activate_license', { key: key.trim() });
}

export async function checkLicense(): Promise<LicenseStatus> {
  return invoke<LicenseStatus>('check_license');
}

export async function deactivateLicense(): Promise<void> {
  await invoke<void>('deactivate_license');
}
