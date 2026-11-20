# Browser CSS fixture verification

Chromium was launched with the actual `src/styles/motion.css` and corrected logo asset in an isolated HTML fixture. This is **not** a running React/Vite application; these screenshots are not used as evidence of React routing or state correctness.

Viewport sizes inspected: 1858×900, 1440×900, 1024×768, 390×844.

- Loader bounds exactly matched each viewport (origin x=0, y=0).
- Logo midpoint coincided with each viewport midpoint (within fractional CSS pixel rounding).
- Background computed pure white `rgb(255, 255, 255)`.
- CSS animation duration computed `1.5s`.
- No horizontal overflow in the fixture.
- Chromium reported `animation-name: none` under simulated reduced-motion preference.

Evidence screenshots: `qa-evidence/workspace-loader-css-desktop.png`, `qa-evidence/workspace-loader-css-mobile.png`.

These checks do not verify actual React navigation guards, focus restoration, Vite build, or timing under real load. Those remain application-browser acceptance items.
