# Prompt for Codex in Antigravity

Integrate the attached JBC 3D PC Builder package into this existing repository's PC build & identify page.

First inspect this repository's instructions, framework, current PC builder implementation, inventory source, category names, selected-build state, quotation/order flow, and styling. Keep all existing working navigation, authentication, inventory, POS, and other modules. Replace the current flat/isometric PC illustration with this real Three.js component.

Use the package's `src/PCBuilder.js`, `src/model.js`, `src/catalog.js`, and `src/pc-builder.css`. If this app is React, adapt `examples/PCBuilderReact.jsx`. Read `INTEGRATION.md` before changing code. Install the documented Three.js dependency using this repository's package manager. Do not replace the repository package.json or install the entire demo as another website.

Map the REAL inventory to `{ id, category, name, stock, price, specs }`. Categories are `cpu`, `motherboard`, `ram`, `gpu`, `storage`, `psu`, `case`, and `cooling`. Use existing stable IDs and actual available stock after reservations. Do not ship `demo-catalog.js` as the production data source. Connect the existing stock subscription/query to `setCatalog` or the wrapper catalog prop.

Connect `onChange` to the existing selected-build state and quote/order inputs without creating state-update loops. Preserve any compatibility engine already in this repository; the new viewer has no compatibility engine. Keep all final price, stock validation, and reservation operations in the existing backend workflow.

Ensure mouse drag/touch rotation, wheel/pinch zoom, click-to-focus parts, selected SKU labels, out-of-stock disabled states, exploded view, panel toggle, reset, subtotal, mobile layout, unmount cleanup, and keyboard part selection work. Handle loading/error states around the real inventory API. Run this repository's relevant checks and production build. Report exactly what was integrated and any remaining limitations. Do not deploy unless I explicitly ask you to deploy.
