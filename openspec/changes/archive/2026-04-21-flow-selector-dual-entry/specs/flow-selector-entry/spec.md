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

### Requirement: Action cards as equal peers after profile selected

Once a profile IS selected, the three action cards (Capture, Setup, Check) SHALL appear without step numbers or lock icons. All three SHALL be enabled and interactable without sequential numbering. The prior linear `Capture → Setup → Verify` stepper (`NoProfilePrompt`) SHALL NOT be rendered anywhere in the app.

#### Scenario: All cards enabled with profile selected
- **WHEN** the overview screen renders after a profile is selected
- **THEN** all three action cards SHALL be enabled and interactable
- **AND** no step numbers, lock icons, or linear stepper SHALL be shown
