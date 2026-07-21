import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveActivityPanel } from './live-activity-panel';
import type { AppEvent } from '@/lib/apply-utils';
import type { ActionProgress, LiveCounters } from '../types';
import React from 'react';

// jsdom doesn't implement scrollTo
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

function makeEvent(overrides: Partial<AppEvent> = {}): AppEvent {
  return {
    app: 'Microsoft.VisualStudioCode',
    action: 'Installed',
    timestamp: Date.now(),
    statusKey: 'installed',
    phase: 'apply',
    ...overrides,
  };
}

const defaultProgress: ActionProgress = {
  message: 'Installing...',
  phase: 'apply',
};

function renderPanel(overrides: Partial<Parameters<typeof LiveActivityPanel>[0]> = {}) {
  const props = {
    liveAppEvents: [makeEvent()],
    liveCounters: undefined,
    actionProgress: defaultProgress,
    activityExpanded: true,
    setActivityExpanded: vi.fn(),
    isAtBottom: true,
    setIsAtBottom: vi.fn(),
    setUserHasScrolledAway: vi.fn(),
    activityScrollRef: { current: null } as React.RefObject<HTMLDivElement>,
    liveActivityContainerRef: { current: null } as React.RefObject<HTMLDivElement>,
    ...overrides,
  };
  return { ...render(<LiveActivityPanel {...props} />), props };
}

describe('LiveActivityPanel', () => {
  describe('rendering', () => {
    it('returns null when event list is empty', () => {
      const { container } = renderPanel({ liveAppEvents: [] });
      expect(container.innerHTML).toBe('');
    });

    it('renders Live activity header', () => {
      renderPanel();
      expect(screen.getByText('Live activity')).toBeInTheDocument();
    });

    it('renders app event entries when expanded', () => {
      renderPanel({
        liveAppEvents: [
          makeEvent({ app: 'Git.Git', name: 'Git', statusKey: 'installed' }),
          makeEvent({ app: 'Zoom.Zoom', name: 'Zoom', statusKey: 'installing' }),
        ],
      });

      expect(screen.getByText('Git')).toBeInTheDocument();
      expect(screen.getByText('Zoom')).toBeInTheDocument();
    });

    it('displays app identifier when name is not provided', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ app: 'Some.App', name: undefined })],
      });
      expect(screen.getByText('Some.App')).toBeInTheDocument();
    });

    it('skips phase header events', () => {
      renderPanel({
        liveAppEvents: [
          makeEvent({ app: '── APPLY ──', action: 'phase' }),
          makeEvent({ app: 'Git.Git', name: 'Git', statusKey: 'installed' }),
          makeEvent({ app: '── VERIFY ──', action: 'phase' }),
        ],
      });

      expect(screen.queryByText('── APPLY ──')).not.toBeInTheDocument();
      expect(screen.queryByText('── VERIFY ──')).not.toBeInTheDocument();
      expect(screen.getByText('Git')).toBeInTheDocument();
    });

    it('does not render event entries when collapsed', () => {
      renderPanel({
        activityExpanded: false,
        liveAppEvents: [makeEvent({ name: 'Git' })],
      });

      // Header still visible
      expect(screen.getByText('Live activity')).toBeInTheDocument();
      // But events are not rendered (they are in the expandable section)
      expect(screen.queryByText('Git')).not.toBeInTheDocument();
    });
  });

  describe('counter badges', () => {
    it('renders installed counter', () => {
      const counters: LiveCounters = { installed: 3, alreadyPresent: 0, skipped: 0, failed: 0 };
      renderPanel({ liveCounters: counters });
      expect(screen.getByText('3 installed')).toBeInTheDocument();
    });

    it('renders present counter', () => {
      const counters: LiveCounters = { installed: 0, alreadyPresent: 2, skipped: 0, failed: 0 };
      renderPanel({ liveCounters: counters });
      expect(screen.getByText('2 present')).toBeInTheDocument();
    });

    it('renders skipped counter', () => {
      const counters: LiveCounters = { installed: 0, alreadyPresent: 0, skipped: 1, failed: 0 };
      renderPanel({ liveCounters: counters });
      expect(screen.getByText('1 skipped')).toBeInTheDocument();
    });

    it('renders failed counter', () => {
      const counters: LiveCounters = { installed: 0, alreadyPresent: 0, skipped: 0, failed: 2 };
      renderPanel({ liveCounters: counters });
      expect(screen.getByText('2 failed')).toBeInTheDocument();
    });

    it('renders configs restored counter', () => {
      const counters: LiveCounters = { installed: 0, alreadyPresent: 0, skipped: 0, failed: 0, configsRestored: 4 };
      renderPanel({ liveCounters: counters });
      expect(screen.getByText('4 restored')).toBeInTheDocument();
    });

    it('hides zero counters', () => {
      const counters: LiveCounters = { installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 };
      renderPanel({ liveCounters: counters });
      expect(screen.queryByText(/installed/)).not.toBeInTheDocument();
      expect(screen.queryByText(/present/)).not.toBeInTheDocument();
      expect(screen.queryByText(/skipped/)).not.toBeInTheDocument();
      expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
    });

    it('renders multiple counters simultaneously', () => {
      const counters: LiveCounters = { installed: 5, alreadyPresent: 3, skipped: 1, failed: 2 };
      renderPanel({ liveCounters: counters });
      expect(screen.getByText('5 installed')).toBeInTheDocument();
      expect(screen.getByText('3 present')).toBeInTheDocument();
      expect(screen.getByText('1 skipped')).toBeInTheDocument();
      expect(screen.getByText('2 failed')).toBeInTheDocument();
    });
  });

  describe('phase colors', () => {
    it('shows VERIFY badge during verify phase', () => {
      renderPanel({
        actionProgress: { message: 'Verifying...', phase: 'verify' },
      });
      expect(screen.getByText('VERIFY')).toBeInTheDocument();
    });

    it('does not show VERIFY badge during apply phase', () => {
      renderPanel({
        actionProgress: { message: 'Installing...', phase: 'apply' },
      });
      expect(screen.queryByText('VERIFY')).not.toBeInTheDocument();
    });
  });

  describe('expand/collapse toggle', () => {
    it('calls setActivityExpanded(false) when clicking header while expanded', () => {
      const { props } = renderPanel({ activityExpanded: true });
      fireEvent.click(screen.getByText('Live activity'));
      expect(props.setActivityExpanded).toHaveBeenCalledWith(false);
    });

    it('calls setActivityExpanded(true) when clicking header while collapsed', () => {
      const { props } = renderPanel({ activityExpanded: false });
      fireEvent.click(screen.getByText('Live activity'));
      expect(props.setActivityExpanded).toHaveBeenCalledWith(true);
    });
  });

  describe('status labels per phase', () => {
    it('renders INSTALLED label for installed status in apply phase', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ statusKey: 'installed', phase: 'apply' })],
      });
      expect(screen.getByText('INSTALLED')).toBeInTheDocument();
    });

    it('renders CONFIRMED label for present status in verify phase', () => {
      renderPanel({
        actionProgress: { message: 'Verifying...', phase: 'verify' },
        liveAppEvents: [makeEvent({ statusKey: 'present', phase: 'verify' })],
      });
      expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    });

    it('renders MISSING label for to_install status in verify phase', () => {
      renderPanel({
        actionProgress: { message: 'Verifying...', phase: 'verify' },
        liveAppEvents: [makeEvent({ statusKey: 'to_install', phase: 'verify' })],
      });
      expect(screen.getByText('MISSING')).toBeInTheDocument();
    });

    it('renders FAILED label for failed status', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ statusKey: 'failed', phase: 'apply' })],
      });
      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });

    it('renders INSTALLING label for installing status', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ statusKey: 'installing', phase: 'apply' })],
      });
      expect(screen.getByText('INSTALLING')).toBeInTheDocument();
    });

    it('renders SKIPPED label for skipped status', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ statusKey: 'skipped', phase: 'apply' })],
      });
      expect(screen.getByText('SKIPPED')).toBeInTheDocument();
    });

    it('renders CANCELLED label for cancelled status', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ statusKey: 'cancelled', phase: 'apply' })],
      });
      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });
  });

  describe('status derivation from action field', () => {
    it('derives present from OK action when no statusKey', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ action: 'OK', statusKey: undefined })],
      });
      expect(screen.getByText('PRESENT')).toBeInTheDocument();
    });

    it('derives installed from Installed action when no statusKey', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ action: 'Installed', statusKey: undefined })],
      });
      expect(screen.getByText('INSTALLED')).toBeInTheDocument();
    });

    it('derives failed from Failed action when no statusKey', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ action: 'Failed', statusKey: undefined })],
      });
      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });

    it('derives skipped from Skipped action when no statusKey', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ action: 'Skipped', statusKey: undefined })],
      });
      expect(screen.getByText('SKIPPED')).toBeInTheDocument();
    });

    it('derives cancelled from Cancelled action when no statusKey', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ action: 'Cancelled', statusKey: undefined })],
      });
      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });

    it('derives installing from Processing action when no statusKey', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ action: 'Processing', statusKey: undefined })],
      });
      expect(screen.getByText('INSTALLING')).toBeInTheDocument();
    });

    it('derives to_install from To install action when no statusKey', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ action: 'To install', statusKey: undefined })],
      });
      expect(screen.getByText('TO INSTALL')).toBeInTheDocument();
    });

    it('defaults to skipped for unknown action when no statusKey', () => {
      renderPanel({
        liveAppEvents: [makeEvent({ action: 'SomeUnknown', statusKey: undefined })],
      });
      expect(screen.getByText('SKIPPED')).toBeInTheDocument();
    });
  });

  describe('restore rows (config settings)', () => {
    const makeRestore = (overrides: Partial<AppEvent> = {}): AppEvent => ({
      app: '⚙ restore:%APPDATA%/Notepad++/contextMenu.xml',
      action: 'RESTORING',
      kind: 'restore',
      restoreStatus: 'restoring',
      name: 'Notepad++ · contextMenu.xml',
      title: './configs/notepad-plus-plus/contextMenu.xml → %APPDATA%/Notepad++/contextMenu.xml',
      statusKey: 'installing',
      timestamp: Date.now(),
      ...overrides,
    });

    it('labels a transitional restore row RESTORING, never INSTALLING', () => {
      renderPanel({ liveAppEvents: [makeRestore()] });
      expect(screen.getByText('RESTORING')).toBeInTheDocument();
      expect(screen.queryByText('INSTALLING')).not.toBeInTheDocument();
    });

    it('labels a terminal restore row RESTORED', () => {
      renderPanel({
        liveAppEvents: [makeRestore({ action: 'RESTORED', restoreStatus: 'restored', statusKey: 'installed', secondary: undefined })],
      });
      expect(screen.getByText('RESTORED')).toBeInTheDocument();
    });

    it('shows the engine display name, never the raw copy-spec', () => {
      const { container } = renderPanel({ liveAppEvents: [makeRestore()] });
      expect(screen.getByText(/Notepad\+\+ · contextMenu\.xml/)).toBeInTheDocument();
      expect(container.textContent).not.toContain('/copy:');
      // The raw source→target detail lives in a hover title, not inline text.
      const row = container.querySelector('[title]') as HTMLElement | null;
      expect(row?.getAttribute('title')).toContain('%APPDATA%/Notepad++/contextMenu.xml');
    });

    it('surfaces a friendly skip reason as muted secondary text', () => {
      renderPanel({
        liveAppEvents: [makeRestore({
          action: 'UP TO DATE',
          restoreStatus: 'skipped_up_to_date',
          statusKey: 'skipped',
          secondary: 'Already matches your saved settings',
        })],
      });
      expect(screen.getByText('UP TO DATE')).toBeInTheDocument();
      expect(screen.getByText(/Already matches your saved settings/)).toBeInTheDocument();
    });
  });

  describe('artifact completion line', () => {
    it('renders a distinct SAVED line, not a DETECTED app row', () => {
      const artifact: AppEvent = {
        app: 'artifact:C:\\profiles\\captured.jsonc',
        action: 'Saved',
        kind: 'artifact',
        name: 'Saved profile bundle',
        secondary: 'captured.jsonc',
        title: 'C:\\profiles\\captured.jsonc',
        statusKey: 'installed',
        phase: 'capture',
        timestamp: Date.now(),
      };
      renderPanel({ liveAppEvents: [artifact] });
      expect(screen.getByText('SAVED')).toBeInTheDocument();
      expect(screen.getByText('Saved profile bundle')).toBeInTheDocument();
      expect(screen.queryByText('DETECTED')).not.toBeInTheDocument();
    });
  });

  describe('jump-to-latest button', () => {
    it('shows Latest button when not at bottom', () => {
      renderPanel({ isAtBottom: false });
      expect(screen.getByRole('button', { name: /jump to latest/i })).toBeInTheDocument();
    });

    it('hides Latest button when at bottom', () => {
      renderPanel({ isAtBottom: true });
      expect(screen.queryByRole('button', { name: /jump to latest/i })).not.toBeInTheDocument();
    });

    it('calls setIsAtBottom(true) when Latest button clicked', () => {
      const { props } = renderPanel({ isAtBottom: false });
      fireEvent.click(screen.getByRole('button', { name: /jump to latest/i }));
      expect(props.setIsAtBottom).toHaveBeenCalledWith(true);
    });
  });
});
