# Public Demo Security Review

The generated package was checked for likely confidential file types (`.env`, private keys, SSH key files) and common high-confidence credential patterns, including GitHub token prefixes and typical API key/private-key patterns. No such files were selected and no matching high-confidence tokens were found.

The application contains illustrative records, demonstration identities, sample names and currency values from the original source. These must not be mistaken for real authenticated user accounts or real financial data.

**Security boundary:** GitHub Pages serves a public static frontend. No production authentication or server-enforced permissions are added. The Admin/Restaurant switcher is demo navigation only. Browser-local storage does not synchronize securely between devices. Never enter actual guest names, personally identifiable employee data, financial information, or confidential resort details into the public demo.

This is a file-pattern review, **not a guarantee** that every source comment, test fixture or design file is free of sensitive information. Review the files in the public commit before pushing.
