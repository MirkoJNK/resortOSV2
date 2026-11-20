# Stage 2 — Source-Rendered Visual Preflight

**Important:** The screenshots in `docs/qa/stage2/SOURCE_PREFLIGHT/` are genuine Chromium renders of the updated integrated React source transpiled into read-only HTML with the actual CSS/assets. **They are not screenshots of the app running through Vite.** The included static renderer does not execute normal React state interactions. The live Vite/React browser screenshots remain a mandatory acceptance check.

The original Stage 1 approved Variant B and baseline screenshots are copied into `docs/qa/stage2/APPROVED_REFERENCES/`. No screenshots were generated or modified with AI.

## Measured Chromium layout

| Viewport | Integrated Support workspace height | Horizontal overflow |
|---|---:|---|
| 1858×900 | 630px | No |
| 1440×900 | 630px | No |
| 1024×768 | 610px | No |
| 390×844 | 1002px | No |
| 1440×1080 | 740px | No |
| 820×768 | 972px | No |
| 821×768 | 610px | No |

The standard Support header measures 135px on desktop. The workspace starts at y=201px at 1440×900 and 1858×900, matching Stage 1.

## Screenshot comparison to approved Variant B

| Viewport | Same dimensions? | Mean absolute channel difference | Fraction of pixels differing |
|---|---|---:|---:|
| 1858x900 | Yes | 0.000293 | 0.0323% |
| 1440x900 | Yes | 0.000380 | 0.0437% |
| 1024x768 | Yes | 0.000665 | 0.0705% |
| 390x844 | Yes | 0.000891 | 0.0875% |

The negligible differences are attributable to minor browser rasterization and dynamic styling details in otherwise matched, source-derived screenshots. These results do not establish production Vite fidelity.

## Motion preflight

Chromium computed-style checks report `ros-enter` for the three System Management groups with 0s/0.055s/0.11s delays and 0.36s duration. With `prefers-reduced-motion: reduce`, all three report `animation-name: none`. See `MOTION_COMPUTED_STYLES.json`.

## Pending live-browser checks

Run the actual Vite application and both existing/new QA scripts to verify stateful interactions, route re-entry motion, keyboard focus, ticket editing, scrolling and real React responsive screenshots. The dedicated script will place screenshots under `QA_Live_Stage2/` only after a real Chrome session is reached.
