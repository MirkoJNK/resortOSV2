# Known Limitations

1. Source application is a browser-local demo, not a live multi-user resort deployment. Support tickets are seeded/in-session demo records.
2. Dashboard series are based on actual saved records only. No fake historical points are injected; empty periods remain zero when storage is valid, or unavailable when storage cannot be read.
3. Native production build and full UI browser QA were not possible: npm dependency registry lookup returned EAI_AGAIN; the source ZIP has no installed React/Vite toolchain.
4. Existing legacy source-structure regression suite remains failing, documented in the SQA report. Do not treat this release as fully production-verified.
5. No live weather integration is claimed: the hero's illustrative weather panel was preserved unchanged from the approved UI.
6. Historical Order/Checkout records remain browser-local and may be missing if the browser profile or IndexedDB is cleared. No cross-device synchronization is implied.
