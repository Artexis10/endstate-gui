/**
 * Auth pane state.
 *
 * Local-component hook (matches the existing `useOverviewState` pattern;
 * deliberately not Zustand — see `openspec/changes/add-hosted-backup-gui/design.md`).
 */

import { useCallback, useState } from 'react';

export type AuthTab = 'sign-in' | 'sign-up' | 'recover';

export interface AuthFormState {
  busy: boolean;
  error: string | null;
  errorCode: string | null;
  errorRemediation: string | null;
}

export interface UseAuthStateResult {
  activeTab: AuthTab;
  setActiveTab: (tab: AuthTab) => void;
  form: AuthFormState;
  setBusy: (busy: boolean) => void;
  setError: (
    err: { code: string; message: string; remediation?: string } | null,
  ) => void;
  resetForm: () => void;
}

const EMPTY: AuthFormState = {
  busy: false,
  error: null,
  errorCode: null,
  errorRemediation: null,
};

export function useAuthState(initialTab: AuthTab = 'sign-in'): UseAuthStateResult {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const [form, setForm] = useState<AuthFormState>(EMPTY);

  const setBusy = useCallback((busy: boolean) => {
    setForm((prev) => ({ ...prev, busy }));
  }, []);

  const setError = useCallback(
    (err: { code: string; message: string; remediation?: string } | null) => {
      setForm((prev) =>
        err === null
          ? { ...prev, error: null, errorCode: null, errorRemediation: null, busy: false }
          : {
              ...prev,
              error: err.message,
              errorCode: err.code,
              errorRemediation: err.remediation ?? null,
              busy: false,
            },
      );
    },
    [],
  );

  const resetForm = useCallback(() => setForm(EMPTY), []);

  return { activeTab, setActiveTab, form, setBusy, setError, resetForm };
}
