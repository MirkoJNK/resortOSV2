# resortOS 2.0 — Help, Support & Notifications SQA Report

**Candidate:** `resortOS_2_0_Help_Support_Notifications_CANDIDATE_20261118.zip`  
**Date:** November 18, 2026 (Asia/Manila)  
**Baseline:** `resortOS_2_0_Permissions_Audit_Log_Refinement_CANDIDATE_20261118.zip`  
**Disposition:** Candidate ready for hands-on review; live-browser sign-off remains outstanding

## 1. Implemented changes

1. **Workspace transitions:** Separated active workspace from displayed route. Help Center and employee support remain shared routes; neither is classified as Administration for transition purposes. Initial loading does not launch the workspace overlay. Authorized workspace changes retain the approved overlay, duration, reduced-motion support, and navigation guards.
2. **Help search:** Kept the approved outer focused search border and suppressed the duplicated native/input inner outline. Existing search and article permissions are unchanged.
3. **Demo support attribution:** Added a versioned, idempotent migration (`demoAttributionVersion: 2`) for explicitly simulated fixture tickets with unknown actor IDs. Restaurant examples use Luis Ramos or Moy Rivera, Front Desk examples use Sofia Cruz, and sample administrative messages use System Administrator. Authentic created tickets and messages with existing employee IDs are preserved.
4. **Initial ticket message:** New employee tickets save their description as the first attributed, timestamped conversation message in the same support collection commit as the ticket. No separate, duplicate post-create write.
5. **Conversation attachments:** Replaced the paperclip placeholder with a multiple-file picker, selected-file chips/removal, attachment-only replies, inline safe raster previews, and authorized downloads. Supported formats: JPEG, PNG, WebP, PDF, DOCX, XLSX, TXT; maximum three files, 10 MB each. File extensions, MIME types where supplied, and recognizable file signatures/format markers are checked before saving. Binary Blobs reside in IndexedDB (`resortos:support-attachments:v1`); messages contain metadata only. Invalid files, oversized files, and closed-ticket replies are rejected. Staged Blobs are rolled back on failed message commit, with delayed cleanup for orphaned staging records after crashes.
6. **Notifications:** Added a central notification model and an accessible bell dropdown. Newly committed, successful Restaurant-to-room postings create one source notification record atomically with the existing operational/audit transaction in IndexedDB schema v9. Front Desk receives individual notifications; authorized Administration receives the same source records, grouped *in presentation only* by unread Manila calendar date. Only new Urgent employee ticket creation adds an administrative support notification, atomically inside the ticket collection. Restaurant receives no automatic notifications. Read states persist by employee ID in `resortos.notifications.read.v1`. No historical unread notifications are manufactured during migration.
7. **Navigation:** Front Desk room-charge notices open the corresponding settlement detail. Administrative room notices open the matching Audit Log event. Urgent ticket notices select the referenced support ticket. Existing page-level authorization remains in force.

## 2. Root causes and architectural decisions

- `departmentForRoute()` returned `admin` for every unrecognized/shared route, and App initialized a transition on first mount. A nullable `workspaceForRoute()` resolves genuine destinations while a separate `activeWorkspace` persists across Help routes.
- The global `input:focus-visible` outline competed with the enclosing `.hc-search:focus-within` ring. A scoped input override keeps one visible focus indicator without disabling the control's accessible focus state.
- New support tickets previously had `messages: []`. The creation pure function now builds the first message before committing the collection.
- The paperclip was a placeholder; large file bytes cannot responsibly be stored as base64 in support localStorage. A separate IndexedDB Blob store is used, with message references, authorization checks at download, and cleanup on failed writes.
- Notifications are created by committed business events, not component-render side effects. The notification record for a room posting is inserted within `commitOperations()`'s existing read/write transaction, alongside receipt and audit evidence. Failed or seeded transactions do not emit notifications. Support urgent events are embedded in the same versioned local support collection as ticket creation.

## 3. Data integrity, security and preservation

- All support records still share `resortos.support.tickets.v1`; old messages without `attachments` load unchanged.
- The migration touches only `simulated === true` tickets where the creator/author ID was unknown. It preserves authored messages, entire ticket bodies, priorities, activity records, and user-created tickets.
- Employee department isolation and effective permissions are re-evaluated before attachment retrieval; a bare attachment ID cannot bypass ticket authorization.
- The active account is rechecked before and after attachment reads. Reply submission rechecks authorization, ticket status, and current identity before committing.
- File URLs are temporary browser Blob URLs, revoked after image preview disposal or download. PDFs, Office files, and TXT are offered for download, not embedded as active documents.
- Notification feeds are derived for the *current* active employee and effective capabilities; Front Desk read state never changes Administration's read state. Even a Restaurant employee granted another capability does not automatically receive notifications.
- No modifications were made to room prices, order totals, payment recording rules, checkout balances, receipt templates, or existing audit detail/Trace View logic, apart from transactional notification writing in the operation commit.
- IndexedDB schema upgrade is additive (8 → 9); pre-existing record stores are never cleared by the upgrade. A one-time support attribution migration is marked with a version to prevent replays.

## 4. Automated verification

| Check | Result |
|---|---|
| New Help/Support/Notifications focused suite | 8 / 8 pass |
| Updated IndexedDB atomic receipts/audit/notification suite | 7 / 7 pass |
| Help + Support / Permissions + Audit integration suites | 27 / 27 pass |
| Existing dirty-draft and transition guards affected by this update | Both corrected assertions pass |
| TypeScript `npm run typecheck` | Pass |
| TypeScript syntax `npm run syntax:ts` | Pass |
| ESLint `npm run lint` | Pass, 0 errors; 11 inherited unused-import warnings after removing a new unused import |
| CSS formatter check `npm run format:css:check` | Pass |
| Production `npm run build` | Pass |

**Full regression comparison:**

| Run | Total | Passed | Failed |
|---|---:|---:|---:|
| Authorized baseline before changes | 583 | 406 | 177 |
| First post-change full run before updating two superseded source assertions | 592 | 413 | 179 |
| Final reconciled full regression run | 592 | 415 | 177 |

The baseline already included **177 inherited failures**, chiefly older release source-integrity checks, legacy snapshot assumptions, and references to a missing `resortOS_v066` source tree. Those historical failures are not claimed to be repaired. The revised draft and transition tests now assert the new accepted behavior (files count as a dirty draft; shared Help routes are not workspaces). No legacy production data was reset or overwritten to satisfy tests.

The final set of failing test names was compared against the pre-change baseline: **no new failing test names remain**.

## 5. Browser QA status

The local Vite preview starts successfully on `127.0.0.1`. Headless Chromium was attempted with a dedicated temporary profile, `--no-sandbox`, GPU/extensions disabled and a fixed desktop viewport. Chromium exited before rendering with:

`FATAL: chrome/browser/process_singleton_posix.cc:297 Check failed: . socket() failed: Operation not permitted (1)`

Therefore **no live browser visual or click-through QA is claimed as passed**. Refer to `MANUAL_QA_CHECKLIST_HELP_SUPPORT_NOTIFICATIONS_20261118.md` for the exact review sequence, including desktop/narrow viewport, keyboard and cross-account persistence.

## 6. Known limitations and remaining risks

- This remains a browser-local demonstration. It does not supply a production server, remote file scanner, multi-device synchronization, server-authenticated employee sessions, or browser push delivery.
- Client-side file-signature checks screen common mismatches but cannot replace full malware scanning or deep PDF/Office document parsing.
- Blob writes and localStorage ticket metadata are separate storage mechanisms. A failed message write rolls back staged files, and stale orphans are cleaned after a day; an abrupt crash can leave an unreferenced Blob temporarily. The support collection uses a revision check, but browser localStorage is not a true multi-device atomic database.
- Notification read states are local to the browser profile and are not synced to other devices.
- Full manual acceptance still needs a browser with working Chromium/system sockets, particularly for focus styling, mobile layout, picker interaction, animation timing, visual overflow and end-to-end room posting.

**Recommendation:** Review the candidate manually using the included checklist before marking it approved or production-ready.
