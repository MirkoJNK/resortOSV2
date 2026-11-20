# resortOS 2.0 — Admin Payment Methods Candidate

Open the `resortOS_v0661_1_hotfix` project folder.

This release adds **Administration → System Management → Pricing & Payments → Payment Methods** and connects its active payment-method list to Front Desk Checkout and individual Front Desk charge payments.

To run on a machine with the project's dependencies available:

```sh
npm install
npm run check:full
npm run dev
```

The actual UI remains the browser-local frontend demonstration. Payment-related actions do **not** process money or verify a real transaction.

Read the companion changelog, compatibility report, changed-file inventory, and SQA report. This candidate is not claimed to be native-browser verified; the CI environment could not install the required Vite/React dependencies.
