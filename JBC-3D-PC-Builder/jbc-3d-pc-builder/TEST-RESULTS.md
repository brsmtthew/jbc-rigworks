# Validation

Validated in this workspace on 2026-09-24.

- Catalog unit tests: 3 passed (invalid inputs, stale/unavailable selection reconciliation, subtotal and snapshot independence).
- Production bundle: Vite build succeeded. Main JavaScript bundle about 552 kB / 142 kB gzip, excluding the optional standalone GLB.
- Chromium with WebGL software rendering: mouse orbit and wheel zoom changed projected geometry; part selection and label replacement worked; unavailable products were disabled; totals updated; a selected product was cleared when stock became zero.
- All eight category controls were reachable; exploded view and glass toggle worked; empty catalog behavior worked; dispose and remount produced exactly one canvas.
- GLB round trip: loaded successfully with GLTFLoader and retained all eight named component groups.
- Mobile layout checked at 390 × 844 CSS pixels, with no horizontal page overflow; mobile-size part selection worked.
- Desktop, exploded-view, and mobile screenshots are in `previews/`.

Not validated: integration into your existing repository, real inventory API, actual touch hardware, real mobile GPU frame rate, production compatibility checks, stock reservations, or checkout. Those belong to the host application and target-device checks.
