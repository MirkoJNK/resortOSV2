# Original resortOS branded page-reveal specification

- **Trigger:** Changes of the AppRoute (`key={area}`), including interdepartmental switches and first render. No new reveal on input changes, tab switches within a route, filter changes or ordinary saves.
- **Source artwork:** Corrected approved resortOS palm and wordmark PNG, never an external logo or NeoLeaf asset.
- **Effect:** Subdued brand layer followed by a left-to-right clipping reveal of the identical logo image; subtle fade out.
- **Timing:** Mask about 250 ms, overall reveal about 330 ms. Easing `cubic-bezier(.22,1,.36,1)` for the mask.
- **Placement:** Fixed overlay rendered as sibling after `.main-content`, no transformed page/modal ancestor, pointer-events:none, not focusable, aria-hidden.
- **Safety:** Immediately available route content, no fake loading percentage, no artificial time gate, no route-state mutation; newest keyed overlay replaces prior on rapid navigation.
- **Accessibility:** Disabled under `prefers-reduced-motion:reduce`.
- **Browser QA:** Native React animation and interruption tests are still required because project npm dependencies were unavailable in this environment. CSS inspection and automated source tests completed only.
