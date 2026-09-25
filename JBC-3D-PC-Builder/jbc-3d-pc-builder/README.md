# JBC RIGWORKS — 3D PC Builder

An embeddable, working Three.js component with a generic ATX PC model, orbit and zoom controls, per-part inspection, and an inventory-driven product picker. Original model geometry; no paid model, image textures, remote assets, or CDN needed at runtime.

## Start the demo

Requires Node.js 20.19+ or 22.12+ and npm.

```bash
npm ci
npm run dev
```

Open the localhost URL printed in your terminal. To build a static bundle:

```bash
npm run build
npm run preview
```

The included `dist/` is a ready-built demo. Serve it over HTTP; opening `index.html` by double-click is not supported because it uses JavaScript modules. A dependency-free option, if Python is installed, is `python -m http.server 8080 --directory dist`.

## Files to use

| File | Purpose |
| --- | --- |
| `src/PCBuilder.js` | Complete embeddable viewer, controls, product picker, and callbacks |
| `src/model.js` | Original editable geometry and named component groups |
| `src/catalog.js` | Inventory validation, selection reconciliation, and subtotal logic |
| `src/pc-builder.css` | Scoped `.jbc-pc` styles; no global page styles |
| `examples/PCBuilderReact.jsx` | React wrapper with unmount cleanup and live catalog updates |
| `examples/inventory-adapter.js` | Example adapter for an existing inventory schema |
| `public/models/jbc-atx-pc.glb` | Standalone model for Blender or another glTF viewer |
| `src/demo-catalog.js` | Fictional stock and illustrative prices; replace for production |
| `INTEGRATION.md` | Detailed integration and API instructions |
| `ANTIGRAVITY-HANDOFF.md` | Task prompt to give your coding assistant in your existing repository |
| `previews/` | Actual browser-rendered desktop, mobile, and exploded-view screenshots |

The main component generates geometry locally; it does not download the GLB. The GLB is an alternate standalone asset with named parts, not a standalone interactive application. Controls, labels, and inventory belong to the JavaScript component.

## Interaction

- Drag with a mouse or one finger to orbit 360° horizontally; vertical orbit lets you see above and below.
- Scroll, pinch, or use + / − to zoom. Right-drag or two-finger movement pans.
- Click a mesh, label, or component card to focus the camera and open its available products.
- The CPU cooler is temporarily hidden during CPU inspection; resetting the view restores it.
- Glass toggles the side panel. Explode separates component groups for inspection.
- Orbit enables slow automatic rotation. Labels toggles annotations. Reset returns to the overview.
- With the canvas focused, arrow keys rotate, + / − zoom, and Home resets.
- All component cards and product buttons can be used with the keyboard.

## Stock and selection behavior

Eight categories: `cpu`, `motherboard`, `ram`, `gpu`, `storage`, `psu`, `case`, `cooling`.
One catalog item per category; a RAM kit is one item. The visual model always shows generic parts, including unselected categories. Changing the selected SKU updates labels and subtotal, not the shape, color, count, or dimensions of the 3D parts.

Out-of-stock products are visible but disabled. `setCatalog()` updates names, stock, and prices, and clears selected products that have been deleted or are no longer available. Empty inventory shows a clear empty state. Inventory data is inserted as text, not HTML.

This is a visual configuration interface. It does not infer socket, RAM generation, case-clearance, BIOS, wattage, or other compatibility. It does not reserve stock or submit orders. Your existing backend should validate selected IDs, availability, compatibility, and prices before quotation/order creation. No customer data or credentials are embedded.

## Testing

```bash
npm test
npx playwright install chromium
npm run test:browser
```

The browser suite tests drag and wheel zoom, selections, labels, disabled unavailable stock, totals, live inventory changes, GLB parsing, remount cleanup, empty inventory, and mobile overflow. WebGL rendering was exercised using Chromium software rendering. Real iPhone/Android hardware performance and your actual application integration remain to be checked.

## Model editing

Change `src/model.js`, then run `npm run export:model` to regenerate the GLB. The exported `JBC_PC` root has eight children named for the categories above. `SidePanel` and `CPUCooler` are named nested groups. The GLB includes the side panel; visibility of hidden nodes is not preserved by the glTF format. Hide `SidePanel` explicitly in a separate viewer if you want the open-case look. Dynamic fan motion and exploded-view transitions are implemented in the component, not baked into the GLB.

## Technology references

- [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html)
- [Three.js GLTFExporter](https://threejs.org/docs/pages/GLTFExporter.html)

Three.js 0.180.0 and Vite 7.1.7 are pinned in the lockfile for this package. This package uses the MIT license; dependencies retain their own licenses.
