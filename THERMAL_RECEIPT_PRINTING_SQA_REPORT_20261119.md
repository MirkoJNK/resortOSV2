# resortOS 2.0 — Thermal Receipt Printing SQA Report

**Candidate:** November 19, 2026  
**Target:** 58 mm primary, 80 mm parity, A4 preserved  
**Decision:** Software QA candidate with no new measured automated-test failures; **physical thermal-printing acceptance is pending**

## 1. Reproducible verification

From the project root:

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm run format:css:check
node --test tests/thermal-receipt-printing.test.mjs
```

The complete application ZIP contains the source, tests, package manifests, and these reports; generated `node_modules` and `dist` are intentionally excluded.

## 2. Measured results

| Check | Before refinement | Final candidate | Assessment |
|---|---:|---:|---|
| Full automated tests | 637 run | 658 run | +21 targeted tests |
| Full automated passed | 460 | 481 | +21 passed |
| Full automated failed | 177 | 177 | Same inherited failure set; no newly failed test |
| Targeted thermal suite | Not present | 21 / 21 passed | Pass |
| TypeScript | Pass | Pass | Pass |
| ESLint | 0 errors, 11 warnings | 0 errors, 11 warnings | Pass with existing warnings |
| Vite production build | Pass | Pass | Pass; inherited chunk-size advisory |
| CSS format check | Pass | Pass | Pass; 17 stylesheets |

The entire original set of 177 failed test names was compared against the final 177 failed test names, producing **zero newly failed names and zero changed failing names**. They are unresolved baseline failures, not a passing overall suite. This report does not conceal or reclassify them.

### Targeted cases added

21 tests in `tests/thermal-receipt-printing.test.mjs` exercise:

- 58 mm paper geometry, 48 mm printable target, balanced 5 mm insets
- 80 mm geometry and 72 mm content target
- A4 width and print path preservation
- All four Builder font presets and the 11 px thermal minimum
- Preview/print CSS parity, readable secondary text, safe non-bold legacy styles
- Historical `Small` layout validation and non-mutation
- Rejection of invalid layout typography by the existing validator
- Safe escaping/wrapping of long text and peso amounts
- No fixed sheet-length constants; short/long page-length calculations
- Failure on invalid or implausibly large measurements
- Font loading and image decode before one print call
- Visible errors for invalid images and blocked print popup
- A4 standard-page handling, historical reprint copy label, source integrity
- All four known print entry points, including Audit Log, using one shared function

## 3. Regression and security review

**Preserved by scope:** Restaurant and Front Desk receipt generation, the Audit Log receipt preview, Builder configuration, A4, transaction records, historical snapshots, and payment/charge calculations. The changes do not modify the business-calculation or persistence modules.

**Print side effects:** `printReceiptDocument` renders an existing document into a popup. It does not call storage-writing, payment-recording, checkout, or order-status APIs. Opening/canceling a print dialog does not create a second transaction through this function. Tests verify that the supplied document remains byte-for-byte equivalent under JSON serialization.

**Untrusted text:** Receipt labels and user text continue to be rendered by React server-side escaping; the test includes HTML-looking item descriptions. A malformed image now causes a controlled print failure rather than an incomplete logo. The print window uses the existing same-origin generated HTML; no new API surface or credentials are introduced.

**No guarantee claimed:** These static/automated checks do not constitute a security penetration test, exhaustive user-flow acceptance, or proof that every historical data variant is covered.

## 4. Visual and physical QA limits

**Browser preview / PDF screenshots:** Not obtained. A browser automation attempt could not reach the locally running app in this execution environment; the native-browser fallback also could not launch. There are therefore no visual screenshots or PDF proof artifacts attached. CSS parity tests do not substitute for visual output.

**Real hardware:** No 58 mm or 80 mm thermal device was attached. Printhead offset, actual physical font readability, logo dithering, driver paper-size handling, automatic cutting, paper advance, and long-document pagination remain **Not tested**. No physical certification is claimed.

**Required gate:** Run the included `WINDOWS_58MM_THERMAL_PRINTER_QA_GUIDE_20261119.md` on a genuine 58 mm printer. Record all 12 mandatory cases, photos, dimensions, printer/driver metadata, and outcome. Repeat the applicable matrix for 80 mm when available and verify A4 through an A4 printer/PDF. Only then decide on production rollout.

## 5. Known issues / operational caveats

1. **177 inherited automated failures** remain in the full suite. They should be triaged separately before declaring entire-application quality gates green.
2. **Browser and driver variability:** Certain Windows drivers may ignore custom CSS `@page` lengths or impose their own cutter feed or paper offset. Physical printer configuration must be calibrated.
3. **Minimum readable font:** 11 CSS px plus increased contrast/weight is a software floor, **not a measured physical-readability result**. A printer with weak heat settings or an unusual dot pitch may need further calibration.
4. **Logo availability:** Printing now waits for included images or surfaces a loading/decode error; unavailable images prevent silent partial prints. Large external or malformed image resources may time out.
5. **Large receipts:** The code rejects pages above a 3000 mm measured length rather than claiming support for arbitrary continuous paper length. Device/driver limits can be lower.
6. **Existing Vite advisory:** The production build reports a large JavaScript chunk warning; it is unrelated to this printing update and does not fail the build.

## 6. Acceptance checklist

| Requirement group | Evidence | Status |
|---|---|---|
| Geometry and non-clipping strategy (58/80 mm) | Shared physical profiles and tests | Implemented; physical measurement pending |
| Excess blank paper / long receipt | Dynamic page-length tests | Implemented; driver feed pending |
| Typography and preview parity | 11 px floor, shared CSS, parity tests | Implemented; physical legibility pending |
| Logos and resource readiness | Async load/decode tests | Implemented; printed image pending |
| Historical integrity and Audit Log | Reprint and entry-point tests | Automated pass |
| A4 compatibility | A4 path and tests | Automated pass; visual check pending |
| No new automated regressions | Full-suite failure-set comparison | Pass relative to baseline |
| Final 58 mm physical acceptance | Actual printer evidence | **Pending** |

**Final recommendation:** Retain this build as a **candidate** until real 58 mm physical printing confirms margins, full content, text readability, and correct feed/cut length. The outstanding full-suite baseline failures should also be tracked explicitly, not hidden in a blanket “tests passed” statement.
