# Embedded JBC 3D builder

Runtime files are adapted from `JBC-3D-PC-Builder/jbc-3d-pc-builder/src/` under the accompanying MIT license. The demo app and sample inventory are not shipped. The model is procedural; no external model downloads are needed.

`../Pc3dBuilder.tsx` loads the core dynamically, maps the shared inventory to its eight category keys, and synchronizes stock selections with `PcBuildingPage`. Only user selection changes update the parent; catalog reconciliation never removes owned or unavailable selections from saved plans. Existing compatibility, request, export, and checkout logic remains in the parent page. The SVG picker is retained as a WebGL/module-loading fallback.

Local adaptations: the core accepts the site's reduced-motion preference and reframes the camera when its container width changes. `integration.css` matches the website, improves text contrast, and fits controls to narrow containers. Keep these changes and the adjacent TypeScript declaration when updating the supplied runtime.

Validation: `npm test -- tests/pc-3d-builder.spec.ts tests/catalog-overhaul.spec.ts`, `npm run build`, and `npm run lint`.
