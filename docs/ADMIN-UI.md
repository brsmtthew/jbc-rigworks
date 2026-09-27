# Admin workspace refresh

The admin workspace now uses grouped navigation, clearer page hierarchy, quieter borders, consistent forms, and more compact operational controls. JBC RigWorks' logo, Montserrat/Inter typography, navy `#022753`, blue `#0466d3`, mist, and white remain in use.

## Coverage

- Dashboard: redesigned metrics and actionable service, quotation, stock, and payment queues.
- Point of sale: compact catalog cards, consistent actions, and a distinct current-order panel.
- Services: segmented views, separate search and status controls, clearer job cards, and persistent intake-form actions.
- Inventory and sales: refined tables, visible horizontal scrolling where needed, readable inventory-name columns, and aligned filters. Inventory displays the item's name rather than replacing it with its brand/model fields.
- Expenses: compact date/payment filters and a persistent editor footer.
- Reports: profit, revenue, collections, and expenses together at the top; consistent report rows and panel padding.
- Settings: personal, business, and workshop groups; compact business fields; operating-day controls and individually grouped appointment windows. Profile, business, delivery, and display dialogs keep their actions outside the scrolling body.
- PC Builds: one page heading and a smaller builder toolbar surrounding the existing 3D integration.

## Bugs addressed

1. Admin headings inherited sticky positioning while being rendered outside the page scroll region. Headings now remain in normal page flow and scroll away with the content.
2. PC Builds mounted two main headings while the builder was open. It now renders one H1.
3. Service filters placed visible labels inside search-field containers. Search and status controls now have separate layouts and accessible labels.
4. Legacy negative margins pushed dialog actions to the edges of their container. Inline actions now use contained margins, and primary record editors have persistent footers.
5. Inventory names could wrap into almost single-character columns. Desktop columns now retain a readable minimum width, with horizontal scrolling inside the table; mobile keeps the existing record-card arrangement.
6. Opening a lazy record editor could suspend the underlying page and lose the opener's focus. Entry dialogs now have their own Suspense boundary. Dialogs capture their opener before child autofocus and restore it on dismissal; keyboard focus handling also includes disclosure summaries.

## Preservation

No business operation, price, stock calculation, payment flow, database schema, or access rule was changed. Verification uses isolated local fixtures and blocks external requests.

The Three.js runtime, model, geometry, lighting, materials, camera logic, and renderer integration were not edited. The production scene chunk remains `PCBuilder-DYhOckPK.js`. Reset, zoom, orbit, glass, explode, labels, and the WebGL fallback were exercised in the browser.

Admin visual rules live in `src/styles/admin.css` and are scoped to `.admin-shell`. Shared changes are limited to dialog containment/focus, heading placement, singular result counts, and the entry-dialog loading boundary. The customer pages were included in the responsive checks.

## Verification

- Production TypeScript/Vite build and ESLint.
- 24 existing local logic/import tests passed.
- Browser layout checks cover all nine admin sections and four customer pages at 1440, 1024, 768, and 390 pixels, using a 900-pixel viewport height.
- Browser checks cover service search, all eight settings sections, nested reference dialogs, three record editors, persistent footers, Escape/focus restoration, header scrolling, and horizontal overflow.
- Separate controls checks cover sidebar collapse, navigation after resizing to mobile, inventory QR lookup, all existing 3D controls, canvas preservation, and a forced WebGL fallback.
- Changed source files pass Prettier checks; Git whitespace checks pass.

Run `npm run test:ui` for both browser suites. Screenshots are saved under `test-results/ui/`, including `-dashboard-1440.png`, `-settings-1440.png`, `business-settings-390.png`, and `admin-3d-controls.png`.

Browser checks use sample records, not the live Firebase service. Live writes and deployment were not performed. Existing large vendor/3D bundle warnings remain.
