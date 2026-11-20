# Interaction specification — resortOS Premium Experience

## Design goal
Calm, tactile, precise and quietly playful. Input and operational status must update immediately; motion is supporting feedback, never a prerequisite for navigation or financial state transitions.

## Tokens and treatment
- Source CSS: `src/styles/premium-interactions.css`; existing `src/styles/motion.css` retained.
- Press acknowledgment: ~105 ms; general hover/input response: ~165 ms; scoped modal entrance: ~210 ms; restrained 6px / ~0.7% entry movement. Existing page entrance timing is reused where not duplicated.
- Buttons visibly react on press. Disabled controls do not receive press transform. Focus-visible ring uses a clear outline separate from hover.
- Inputs animate wrapper border/shadow only; no per-character or currency digit animation.
- Native select components remain native. Existing responsive and semantic control behavior is preserved.
- Motion disabled when OS requests `prefers-reduced-motion: reduce`, and additionally via `html.ros-local-reduced-motion` when the local preference is active.

## Feedback preference control
Located in Topbar, adjacent to the existing account/status area. The popover offers Sounds, optional Haptics when browser capability exists, and Reduce motion. Preference key: `resortos.feedback.preferences.v1`; validated booleans only; failed/unknown values reset to safe defaults. All default false; system reduced motion takes precedence. UI preferences never enter the guest/charge/order IndexedDB records.

## Optional sounds and haptics
- Short locally synthesized sine tone with Web Audio, quiet level (peak gain ~0.022), ~65ms click and ~150ms success, no external assets or background loops.
- Brief optional vibration (6ms selection, 12ms success) only if available.
- 90ms cue throttle prevents overlapping bursts. Missing device APIs must not block the underlying action.
- Current click cue uses delegated button activation; success cue is emitted only for events dispatched after committed operations (Restaurant operations change, saved configuration feedback). No user-perceived 'payment completed' cue is generated merely by opening a confirmation.

## Save and error semantics
- Existing domain commit and optimistic revision checks are authoritative. Successful operational transitions generate the existing change event *after* persistence succeeds.
- Presentation does not alter amount calculation, guest/stay association, settlement, order cancellation, or checkout writes.
- Invalid/failed persistence remains an error; no false completed statuses are introduced.
- These additions do not substitute for comprehensive screen-reader live announcements; native UI/browser confirmation still needs real-device accessibility evaluation.

## Accessibility and verification status
- Focus-visible and OS/local reduced-motion support implemented in CSS.
- New component supports mouse, keyboard-operable native checkbox controls, Escape dismissal, outside-click dismissal and validated preference persistence.
- Actual focus traversal, screen-reader, keyboard and UI animation fluidity in the running React app **not verified**, because native dependencies are unavailable. Documented as outstanding QA, not passed.
