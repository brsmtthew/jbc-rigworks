# JBC RigWorks frontend

## Run and verify

- `npm run dev` starts the local Vite app.
- `npm run build` checks TypeScript and produces the production bundle.
- `npm run lint` checks source and tests.
- `npm test` runs the Edge browser regression and accessibility checks. Screenshots are disabled.

## Available workflows

- Admin: manage service jobs, inventory, sales, payments, expenses, and reports; process walk-in and online transactions through Point of sale.
- POS: select stock or priced services, itemize labor, delivery, other charges, discounts, and tax; complete checkout, deduct stock, and print invoices. Invoices preserve prices, business details, and charges. Updating payment does not rewrite the original invoice lines.
- Customer: save appointment requests and PC briefs, place local online orders for workshop pickup, and print invoices from My orders. Online checkout records an unpaid order; it does not collect a payment.
- Service prices: separate editable Low/Mid/High deep-clean prices for desktop and laptop devices. Amounts start unset; set them under Workspace settings. Unset services cannot be purchased.
- PC building: component dropdowns use inventory. Set component type, tier, socket, and memory generation in Add/Edit inventory. Starter, Everyday, and Performance presets suggest available parts; missing parts remain unselected. Set classification uses the lowest available CPU/GPU/RAM tier assigned by the workshop. Unlisted or owned components can be entered in every slot, with capacity-based estimates for core parts. Plans do not reserve stock. Previous manual plans remain available with their original notes and matching stock selections.
- PC identifier: an explicit heuristic estimates service tier from entered physical cores, RAM, and dedicated graphics memory. It is not automatic hardware detection or a verified benchmark. The result and its limitations are shown together.
- Settings: admins edit business/invoice details, charges, tax, and prices. Both roles have their own profile, contact details, density, and reduced-motion preferences. Credential changes remain deferred with authentication.
- All former CSV downloads are native `.xlsx` workbooks with numeric values, styled headers, filters, and frozen headings. The Excel library is loaded only when exporting.
- Dashboard and reports calculate from saved records. Revenue and profit exclude configured sales tax; invoice totals and balances include it. Payments are attributed to the original sale's period. Inventory purchases are not automatically operating expenses; POS snapshots the cost of sold stock.
- Compatibility checks flag known socket and memory-generation mismatches. BIOS, power, interfaces, and physical clearances still need workshop verification.

## Local storage and future integration

This frontend works without Firebase, a database, or Express. Admin records use `jbc-rigworks:workspace:v1:<email>`. The last active admin is selected by `jbc-rigworks:shop-owner:v1`; customer shop/building views use that workshop's inventory, and checkout writes to that workshop's sales. A single localStorage write commits stock and sale changes together, and Web Locks serialize checkout across tabs where available.

Settings use `jbc-rigworks:shop-settings:v1` and `jbc-rigworks:account:v1:<email>`. Stock-based plans use `jbc-rigworks:stock-builds:v1:<email>` and import previous `jbc-rigworks:builds:v1:<email>` plans. Existing customer request keys remain compatible.

Records persist in the same browser. Customer order lists show only records linked to the entered email; this is not authenticated account isolation. Local sign-in does not verify credentials. Orders are shared between roles in the same browser only; nothing is transmitted across devices. Clearing browser data removes local records.

The future API can replace `src/lib/workspaceStorage.ts` and `src/lib/customerStorage.ts`. Authentication belongs in `src/lib/auth.tsx`; server-side role checks must accompany that integration.

## UI conventions

Official color tokens stay in `src/styles/brand.css`. Shared layout lives in `src/App.css`, `src/styles/workspace.css`, and `src/styles/commerce.css`. The topbar and portaled page headings sit outside the content scroller, so their positions remain unchanged from the first scroll; desktop table headings remain visible inside scrollable tables. Mobile navigation uses an accessible dialog, and tables use stacked rows. Invoice print CSS hides the application shell and prints only the itemized invoice. Tests verify print media without taking screenshots or opening image previews.

## Latest workspace behavior

- Admin and customer dashboards display analytics and summaries. Admins can change the reporting period; creation and operational navigation live on the relevant pages.
- Customer navigation is Dashboard, Services & booking, PC builder, Shop, and My records. Profile, settings, and sign-out are available from the navbar account dialog. Admin Service prices navigation is replaced by PC identifier; cleaning prices remain editable in account settings. The topbar shows Manila date/time instead of global search.
- PC builder combines stock selection, owned/unlisted parts, spec estimation, saved plans, request submission, and checkout. A request snapshots selected part models, sources, tier estimate, budget, and notes. Only stocked components can proceed to checkout. CPU/socket and memory-generation conflicts are flagged; full compatibility still requires workshop review.
- Home-service bookings store address, user-entered one-way road distance, service base price, visit surcharge, transport, and estimated tax/total. Transport is base fee plus distance times per-kilometre rate. Unset rates are displayed as quote required, never silently treated as a priced service.
- Administrators create product bundles in POS by naming a set of at least two distinct inventory items and their quantities. Shop customers can select these bundles. A selected complete bundle or all eight components ordered as a PC set guarantees free delivery. Incomplete sets revert to standard distance charges. Checkout revalidates bundle contents and stock before committing.
- Standalone item delivery requires address, contact, positive distance, and configured transport rates. Pickup has no delivery charge. Bundles qualify for free delivery even when standard transport rates are unset.
- Every purchased inventory line snapshots warranty duration, terms, start date, and expiry date. Inventory overrides take priority over the default warranty in settings. Unspecified terms/duration are shown as pending workshop confirmation. Later settings changes do not change saved warranties. Customers open invoices and warranty details through My records.
- App-level error recovery, form errors, settings normalization, and guarded workspace reads prevent silent failures. Invalid workspace records pause saving instead of overwriting the existing local data.

Before using real prices, configure the separate desktop/laptop cleaning catalog, home-service surcharge, transport base/per-km rates, and warranty duration/terms under Workspace settings. No business rates or warranty promises were invented. Home visits and builds are reviewed through Service jobs in the same browser; delivery distance is an entered estimate rather than geocoding.
## Dialog workflows and readability

- POS now separates browsing/cart selection from a review-and-checkout dialog. Bundles open from the page action; customers retain the same stock, delivery, warranty, and invoice rules.
- Booking opens a focused appointment dialog. The service estimate has its own padded surface, and the estimated total and submit action remain available in the dialog footer. Closing the dialog keeps the draft during the current visit.
- Settings starts with a profile summary and compact task buttons. Profile, display, business, pricing, and delivery/warranty settings have separate dialogs. Cancel discards that edit; saving a profile does not modify shop settings.
- PC quote requests and tier explanations open in dialogs, reducing the builder sidebar's length. Existing inventory, sales, expense, and job editing dialogs remain available.
- Excel exports first create a read-only snapshot preview. Pagination can inspect every row; Cancel downloads nothing. Download Excel generates the reviewed snapshot as a native workbook.
- Record tables support numeric/text sorting and 10/25/50-row pagination. Filters reset the current page. Mobile tables expose a sort selector while retaining their stacked record layout.
- Comfortable text sizes, padded dashboard analytics, consistent cards, and visible table dividers are in `src/styles/workflows.css`. Navigation uses a brief opacity transition without moving the stationary heading. Actual asynchronous export/checkout work displays a busy state, and reduced-motion preferences disable animations.

## Directories, stock tracking, and request processing

- Directories provides CRUD for inventory/expense categories, payment methods, sockets, memory generations, booking services/time slots, and build purposes. Category inputs permit a custom value and suggest directory entries. Structural component types, spec tiers, and transaction statuses remain fixed because business logic depends on them. Part-model dropdowns come from available inventory, with per-component tier and model/SKU filters.
- The fee directory edits default VAT/tax and labor, and stores reusable labor, other-fee, deduction, and tax presets. Applying a preset replaces the corresponding checkout field; it does not add a second hidden charge. New transactions use current defaults; issued invoices retain their snapshots.
- PC input is organized into component dialogs and a build-details dialog. Admins create/edit/delete PC sets or general bundles from available stock in the POS bundle editor. Known socket/memory conflicts and unavailable quantities block saving.
- Inventory entry includes component metadata, specifications, a JPEG/PNG/WebP photo up to 500 KB, item warranty, and stock-adjustment reasons. Customers inspect photos/specifications/warranty in a product dialog. Missing photos show a component icon. Deleting stock used by a bundle is blocked until the bundle is updated.
- Inventory QR tracking supports camera scanning, uploaded QR images, and manual/USB-reader SKU entry. Labels encode a stable inventory ID (jbc-stock:<id>) and can be downloaded as PNGs. Scanning only looks up a record; it never changes quantities automatically. Adjustments and completed sales append stock movements. The camera starts only after the scan action and stops when the scanner closes. Camera access requires browser permission and a secure context (HTTPS or localhost). Decoder and QR generation code load on demand.
- POS product cards and the current order start on the same row. Checkout includes a cash calculator with keypad, quick cash increments, change, and remaining balance. Applying it caps the invoice payment at the total and separately records cash tendered/change on the invoice.
- Service jobs includes a booking/build request inbox and online order processing. New requests retain their shop owner; older requests without an owner remain visible for local migration. Receiving a booking creates one linked job and confirms the request. Status changes are reflected in customer records. Pending customer requests support notes/schedule edits and deletion from detail dialogs. Invoices remain retained; manual entries, jobs, inventory, bundles, and directory entries support deletion with confirmation.
- The navbar account dialog contains profile and website settings. Operational actions use icons with accessible names and tooltips. Input dialogs retain focus trapping, Escape dismissal, responsive sizing, and reduced-motion support.
- Sales and collections are shown as a graph with keyboard-focusable points and a live readout. The chart-value expansion table has been removed. Expense breakdown ranks categories by spend and displays their percentage shares.

Directory values are stored at jbc-rigworks:directories:v1. Business defaults and request storage retain their existing keys. No database, Express server, online payment, cross-device request delivery, or verified authentication has been added.
