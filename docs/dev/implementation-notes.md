# Capture Save State Implementation Notes

## Changes Required

### 1. App.tsx State Additions (after line 165)
```typescript
// Saved profile state - separate from overviewActionResult to persist after save
const [lastSavedProfile, setLastSavedProfile] = useState<{ name: string; path: string; timestamp: Date } | null>(null);

// Save in progress flag to prevent double-submit
const [isSavingProfile, setIsSavingProfile] = useState(false);
```

### 2. handleSaveProfileName Updates
- Add `if (isSavingProfile) return;` at start
- Add `setIsSavingProfile(true);` before try block
- After successful save (line 396+), add:
```typescript
// Set saved profile state for green card
if (savedProfile) {
  setLastSavedProfile({
    name: savedProfile.displayName || savedProfile.name,
    path: savedProfile.path,
    timestamp: new Date()
  });
}
```
- In catch block, change error toast to include error message
- Add `finally { setIsSavingProfile(false); }` at end
- Move modal close logic inside try block (only close on success)

### 3. Pass Props to OverviewScreen (line 1793+)
Add after onSaveProfile:
```typescript
pendingCaptureDraftPath={pendingCaptureDraftPath}
lastSavedProfile={lastSavedProfile}
onDismissSaved={() => setLastSavedProfile(null)}
```

### 4. OverviewScreen Interface (line 134+)
Add to interface:
```typescript
pendingCaptureDraftPath?: string | null;
lastSavedProfile?: { name: string; path: string; timestamp: Date } | null;
onDismissSaved?: () => void;
```

### 5. OverviewScreen Destructuring (line 165+)
Add to destructured props:
```typescript
pendingCaptureDraftPath,
lastSavedProfile,
onDismissSaved,
```

### 6. Capture Card Condition (line 619)
Change from:
```typescript
{action === 'capture' ? (
```
To:
```typescript
{action === 'capture' && pendingCaptureDraftPath ? (
```

### 7. Add Saved Profile Card (after line 665, after </AnimatePresence>)
```typescript
{/* Saved profile state - green card shown after successful save */}
<AnimatePresence mode="wait">
{lastSavedProfile && (
  <motion.div
    key="saved"
    variants={fadeSlideVariants}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    <div className="flex items-center gap-3 bg-success/10 rounded-md px-3 py-3">
      <CheckCircle2 className="h-4 w-4 text-success" />
      <div className="flex-1">
        <p className="text-sm font-medium text-success">
          Profile saved
        </p>
        <p className="text-xs text-muted-foreground">
          {lastSavedProfile.name}
        </p>
      </div>
      {onDismissSaved && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDismissSaved();
          }}
        >
          Dismiss
        </Button>
      )}
    </div>
  </motion.div>
)}
</AnimatePresence>
```

### 8. Clear lastSavedProfile on New Capture (line 1573+, in onCapture)
Add after setOverviewRunningAction:
```typescript
setLastSavedProfile(null); // Clear saved state when starting new capture
```

## Testing
- npm run build
- npm test
- npx playwright test e2e/save-profile-opt-in.spec.ts

## Commit Message
fix(ux): restore capture save state card and harden save flow

- Add dedicated lastSavedProfile state separate from overviewActionResult
- Show amber draft card only when pendingCaptureDraftPath exists
- Show green "Profile saved" card after successful save
- Add isSavingProfile flag to prevent double-submit
- Improve error handling: keep draft and show actionable error message
- Do not close save modal on error to allow retry
