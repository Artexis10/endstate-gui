## ADDED Requirements

### Requirement: Dual-flow entry screen
When no profile is selected, the GUI SHALL present two entry flows side by side: "Save this computer" (Capture) and "Set up this machine" (Apply).

#### Scenario: Split view with no profiles on disk
- GIVEN no profile is selected AND no profiles exist on disk
- WHEN the overview screen renders
- THEN the FlowSelector shows two equal panels without profile count badge

#### Scenario: Split view with profiles on disk
- GIVEN no profile is selected AND profiles exist on disk
- WHEN the overview screen renders
- THEN the "Set up this machine" panel shows a profile count badge

#### Scenario: Expand capture flow
- GIVEN the split view is displayed
- WHEN the user clicks "Save this computer"
- THEN the left panel expands to full width with capture content and a back button

#### Scenario: Expand setup flow with profiles available
- GIVEN the split view is displayed AND profiles exist on disk
- WHEN the user clicks "Set up this machine"
- THEN the right panel expands to full width with a profile selector dropdown

#### Scenario: Expand setup flow with no profiles
- GIVEN the split view is displayed AND no profiles exist on disk
- WHEN the user clicks "Set up this machine"
- THEN the right panel expands with empty-state guidance, "Open profiles folder" button, "Refresh" button, and "Capture instead" link

#### Scenario: Profile selection exits FlowSelector
- GIVEN the setup flow is expanded with profiles available
- WHEN the user selects a profile from the dropdown
- THEN the FlowSelector unmounts and normal action cards appear

#### Scenario: Back button returns to split view
- GIVEN either flow is expanded
- WHEN the user clicks the back button
- THEN the view returns to the side-by-side split

## REMOVED Requirements

### Requirement: Linear stepper (NoProfilePrompt)
The sequential Capture → Setup → Verify stepper with step numbers and lock icons is removed.

## MODIFIED Requirements

### Requirement: Action cards as equal peers
When a profile IS selected, the three action cards (Capture, Setup, Check) SHALL appear without step numbers or lock icons.

#### Scenario: All cards enabled with profile selected
- GIVEN a profile is selected
- WHEN the overview screen renders action cards
- THEN all three cards are enabled and interactable without sequential numbering
