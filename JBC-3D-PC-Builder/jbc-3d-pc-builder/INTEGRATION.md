# Integrate into your existing JBC website

This package supplies the PC-building feature only. Keep your current navigation, login, inventory, POS, and order workflow. No deployment or repository modification has been performed for you.

## React + Vite

1. Copy `src/PCBuilder.js`, `src/model.js`, `src/catalog.js`, and `src/pc-builder.css` into `src/features/pc-builder/` in your app.
2. Copy `examples/PCBuilderReact.jsx` into the same folder and change its imports from `../src/PCBuilder.js` / `../src/pc-builder.css` to `./PCBuilder.js` / `./pc-builder.css`.
3. Install the runtime dependency in your app:

```bash
npm install three@0.180.0
```

4. Render the wrapper where the old PC diagram lives:

```jsx
import { useMemo, useState } from 'react';
import PCBuilderReact from './features/pc-builder/PCBuilderReact.jsx';
import { toBuilderCatalog } from './features/pc-builder/inventory-adapter.js';

export function PCBuildPage({ inventoryRows }) {
  const catalog = useMemo(() => toBuilderCatalog(inventoryRows), [inventoryRows]);
  const [build, setBuild] = useState(null);

  return (
    <>
      <PCBuilderReact catalog={catalog} onBuildChange={setBuild} />
      <p>{build?.selectedCount ?? 0} parts selected</p>
    </>
  );
}
```

Copy the adapter example too, then map its fields to your real schema. Do not replace your app's inventory with the sample inventory. Memoize the catalog array so a build callback does not cause an unnecessary catalog-update loop. `initialSelection` is read on mount; to implement an externally controlled build, call the core instance's `setSelection()` from your own wrapper and avoid reflecting callback changes back without checking for equality.

If you use Next.js, render this wrapper on the client (`'use client'`); the viewer needs a browser and WebGL. Catch initialization failure in your wrapper if you want to keep an alternate non-3D picker available.

## Vanilla JavaScript or another framework

```js
import { createPCBuilder } from './features/pc-builder/PCBuilder.js';
import './features/pc-builder/pc-builder.css';

const builder = createPCBuilder(document.querySelector('#pc-builder'), {
  catalog: [
    {
      id: 'your-existing-stock-id',
      category: 'cpu',
      name: 'Your actual processor name',
      stock: 4,
      price: 11500,
      specs: 'Optional descriptive text',
    },
  ],
  currency: 'PHP',
  locale: 'en-PH',
  onChange(build, { reason }) {
    // Store selected IDs in your existing form or app state.
    // Do not write stock deductions here.
    console.log(build.selection, build.total, reason);
  },
  onPartFocus(category) {
    console.log('Inspecting', category);
  },
});

// In your existing inventory subscription:
builder.setCatalog(updatedCatalog);

// On route unmount:
builder.dispose();
```

`updatedCatalog` above means the array from your existing stock subscription/API; no endpoint is assumed or hard-coded.

## Inventory schema

| Field | Type | Rule |
| --- | --- | --- |
| `id` | string | Unique, nonempty, stable stock/SKU ID |
| `category` | string | One of the eight exact category keys |
| `name` | string | Nonempty product name |
| `stock` | number | Nonnegative integer; use available units after reservations |
| `price` | number | Nonnegative unit selling price in the selected currency |
| `specs` | string | Optional display text |

Unknown categories, duplicate IDs, or invalid stock/prices throw a descriptive error. Map non-PC products out before passing the array. Catch and display API/adapter errors in your app. The viewer deliberately does not guess your server's field names.

## Public API

| Method | Behavior |
| --- | --- |
| `getBuild()` | Current `{ selection, parts, total, selectedCount, complete }` |
| `setCatalog(items)` | Validate and replace catalog; reconcile current selection; emit change |
| `setSelection({ cpu: 'id', ... })` | Replace selection; omit invalid/unavailable IDs; emit change |
| `focusPart('gpu')` | Open matching category and move the camera closer |
| `resetView()` | Restore overview and CPU cooler; retain product selections and exploded state |
| `setExploded(true)` | Separate components and reframe the overview |
| `dispose()` | Remove DOM, animation loop, listeners, observers, controls, and GPU resources |

Change reasons: `selection`, `catalog`, `external-selection`. No change event fires on initial mounting of the core viewer; call `getBuild()` if the parent needs the initial snapshot. The React wrapper calls `setCatalog` after mounting, which provides a snapshot callback.

A bubbling `jbc:build-change` DOM event is also emitted from the host, with the build snapshot and `reason` in `event.detail`. Do not subscribe to both the callback and the DOM event if that would duplicate your own side effects.

## Connect to quotation / order

Use `build.selection` to send product IDs to your existing backend. The displayed subtotal is an estimate derived from the client catalog. Let the backend load authoritative prices, verify compatibility and available quantities, and reserve stock atomically in your existing order transaction. `complete` only means all eight categories have selections; it is not a compatibility result. Builds that intentionally omit a dedicated GPU or aftermarket cooler may have fewer than eight selections and can be handled by your parent form.

## Layout and performance

Use a container with width 100%. The component has a desktop viewer and stock panel, stacking on smaller screens. Styles are scoped to `.jbc-pc`; customize its CSS variables or stylesheet to fit your existing card. It does not add page navigation or authentication.

The pixel ratio is capped at 2, shadows use a 1024px map, and rendering is skipped while offscreen or while the document is hidden. Reduced-motion preferences suppress fan movement and camera transitions. Consider lazy-loading the feature route in your app. Real mobile GPU performance should be checked on your target devices before release.

## Optional standalone GLB

`public/models/jbc-atx-pc.glb` can be imported into Blender, Three.js, or another glTF tool. Named groups provide selection IDs. To use only the GLB, you must wire up your own controls, raycasting, labels, and inventory UI. The included core viewer already provides these features using the same original procedural geometry and does not need the GLB at runtime.
