# Embedded JBC 3D builder

Runtime files were adapted from the supplied standalone JBC 3D PC Builder under the accompanying MIT license. The unused standalone demo, generated model files, and sample inventory have been removed from this repository. This folder is the maintained runtime. The model is procedural; no external model downloads are needed.

`../Pc3dBuilder.tsx` loads the core dynamically, maps the shared inventory to its eight category keys, and synchronizes stock selections with `PcBuildingPage`. Only user selection changes update the parent; catalog reconciliation never removes owned or unavailable selections from saved plans. Existing compatibility, request, export, and checkout logic remains in the parent page. The SVG picker is retained as a WebGL/module-loading fallback.

Local adaptations: the core accepts the site's reduced-motion preference and reframes the camera when its container width changes. `integration.css` matches the website, improves text contrast, and fits controls to narrow containers. Keep these changes and the adjacent TypeScript declaration when updating the supplied runtime.

Validation: `npm run build` and `npm run lint`. The optional isolated browser suite is `npm run test:ui`; it includes the builder but is not part of the default local test command. The retired local-storage browser suites no longer represent this app and were removed. Do not run browser previews or emulator tests when the task excludes them.
