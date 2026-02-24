/**
 * Overview (Home) Screen - Re-export from refactored module
 *
 * ADR-001 ARCHIVE NOTE: The overview screen is no longer the default entry point.
 * The app now opens to IntentLanding. This re-export is maintained for
 * backward compatibility with existing tests and imports.
 *
 * The actual implementation is in ./overview/overview-screen.tsx
 */

export { OverviewScreen } from './overview';
export type { OverviewScreenProps } from './overview';
