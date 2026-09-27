# Customer UI redesign

Implemented from `JBC-Enhanced-Separate-UI/README.md` and `JBC-RIGWORKS-Login-Customer-Redesign-Prompt.md`. The written requirements govern behavior; live records remain the content source. Original logo assets are retained. No concept PNG is used as a production page, product image, or PC model.

## Routes and coverage

| Reference screens | Route / area                           | Implemented change                                                                                                                                                                         |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01–02             | `/login`, `/register`                  | Balanced branding/form layout, one account-switch link, inline password visibility, named autofill fields, real Firebase recovery with retry and feedback                                  |
| 03                | `/customer`                            | Action-first greeting, active appointment count, next appointment, compact requests/orders, loading/error states; spending moved to purchase history                                       |
| 04                | `/customer/services`, `/customer/book` | Device filters and search, duration and location metadata, existing descriptions/inclusions and estimate prices                                                                            |
| 05–07             | Booking dialog                         | One progress sequence: Service → Location & device → Schedule → Review; Back preserves values, slots use the actual schedule, success includes the persisted reference                     |
| 08                | `/customer/pc-building`                | Viewer/configuration columns on desktop, viewer-first layout on mobile, one customer configuration list and summary, compact actions                                                       |
| 09                | Build details                          | Existing names, budgets, saved builds, deletion and export retained; loading another plan prompts before discarding edits                                                                  |
| 10                | Component picker                       | Initial source selected, local draft edits, explicit Use/Cancel/Clear, stock-aware inventory search and brand filters, distinct data/loading/empty states                                  |
| 11–12             | `/customer/shop`, cart, checkout       | Visible category/brand/availability/price/sort labels, count and clear filters, consistent product imagery/fallback, appropriate empty-cart action; existing checkout retained             |
| 13–15             | `/customer/records`                    | Existing record tabs, search/status filters, text-and-color statuses, compact appointment/build rows, labelled details and receipts, direct appointment-reference links                    |
| 16–18             | `/customer/settings`                   | One page with Profile & contact and Display & account access; clear read-only sign-in email, photo controls, persisted preferences, saved/error feedback and unsaved-navigation protection |

The account menu links directly to settings and contains customer sign-out. The customer clock is removed from the main header; the admin header retains its existing controls.

## Code-confirmed issues addressed

- Customer headings were portalled into a separate header host and also inherited sticky positioning. Customer headings now render in the scrolling page and use static positioning; only the compact top bar remains fixed above the primary content scroll area. Admin header behavior is preserved.
- The component picker initialized its source to `null`, leaving its content blank. It now opens the current source, defaulting to inventory.
- Choosing the owned source or typing owned fields immediately mutated the build. Picker drafts now commit only on Use component; Cancel and Escape leave the existing selection unchanged.
- Booking used separate location/detail dialogs with no progress or review step. It now uses one dialog and preserves the draft when going back or changing location.
- Address fallback used `address || profile.address`, so clearing the field restored the saved address. A nullable initial choice now allows deliberate edits and clearing; required-field validation still applies.
- Dashboard counts and shop/orders could show an empty state while subscriptions were loading. They now wait for loading/error resolution before presenting counts or empty data.
- The shop's visible “All” filters did not explain their fields. Each has a visible label based on its existing filter implementation.
- Saved-build selection was disabled while dirty. It now permits an explicit discard-and-load confirmation.
- Builder power could appear meaningful with insufficient selections. Display now waits for base components and actual CPU/GPU ratings; existing compatibility calculations remain unchanged. Other component power uses the existing baseline allowances and is described as approximate.
- Customer account settings required nested dialogs. The new page uses two internal sections and React Router navigation blocking for unsaved edits. Browser unload is also guarded.

These are source findings and code changes, not claims that the original screenshot defects were reproduced in a browser.

## Main files

- `src/styles/customer.css`: customer/auth tokens, shell, responsive layouts, dialogs, forms, builder surrounds, shop and account presentation. Customer selectors avoid restyling the admin workspace.
- `src/components/layout/WorkspaceShell.tsx`, `Topbar.tsx`, `Sidebar.tsx`: customer heading flow, compact context/account navigation and sidebar presentation.
- `src/features/auth/AuthPage.tsx`: sign-in, registration and provider-backed recovery.
- `src/features/customer/BookingPage.tsx`, `CustomerHomePage.tsx`, `RecordsPage.tsx`, `CustomerRecordsPage.tsx`, `CustomerOrdersPage.tsx`, `RecordStatus.tsx`: customer workflows and record presentation.
- `src/features/builder/PcBuildingPage.tsx`, `ComponentSelector.tsx`, `usePcBuilder.ts`, `pc.ts`: configuration layout, picker drafts, saved-build interaction and power-display readiness.
- `src/features/pos/PosPage.tsx`, `CartPanel.tsx`: customer catalog/filter/cart presentation. Checkout transactions are unchanged.
- `src/features/settings/CustomerSettings.tsx`: customer profile/preferences using existing account storage and Firebase Auth.
- `src/App.tsx`, `src/routes.tsx`: customer stylesheet and settings route; React Router's data-router wrapper enables the unsaved-navigation blocker without changing URLs or authorization.

No additional dependency, feature folder, database collection, or backend service was introduced.

## 3D and data preservation

The Three.js runtime, geometry, materials, scene, lighting, camera controls, component mapping, renderer mount/disposal, and ResizeObserver were not edited. Its production chunk remains `PCBuilder-DYhOckPK.js`, matching the pre-redesign build. Reset, zoom, orbit, glass, explode, labels and hotspot callbacks remain wired through the existing integration. Customer CSS removes duplicate surrounding catalog panels; the live canvas stays mounted in its existing React component. WebGL fallback remains available.

Existing IDs, roles, ownership queries, prices, service catalog, stock verification, quote requests, payment proofs, receipts, exports and warranty snapshots are retained. Customer-owned parts remain excluded from JBC's subtotal. Home-service transportation awaiting address review stays unknown rather than zero. Quote and booking requests are not represented as paid orders.

## Verification performed

- TypeScript and production build: passed.
- Full ESLint check: passed.
- Local logic/import-graph suite: 24 passed, including stock/payment idempotency, capacity, owned builds, compatibility and the added power-readiness regression case.
- Git whitespace check: passed.
- Calculated contrast for the selected token pairs: white/primary blue **5.32:1**, body/white **14.64:1**, secondary text/canvas **5.58:1**, sidebar supporting text/navy **10.38:1**. This is a token check, not certification of every rendered state.

The optional browser suite's heading selector was updated for the new customer layout. It was not executed. No screenshots, image previews, browser sessions, Firebase emulator tests, live database writes or deployment were performed. Existing large vendor chunk warnings remain.

## Remaining verification and content gaps

Responsive breakpoints target narrow phones, tablets, laptops and desktops, but actual 360/390/768/1366/1920 viewport behavior, keyboard/focus interactions, native dialogs, 3D controls and WebGL fallback still need browser/device verification. Sign-in, recovery email delivery, booking submission, checkout and profile persistence need live-environment verification; passing local tests does not certify these integrations.

Services only show inclusions supplied in the catalog. Missing descriptions/inclusions require workshop content; no package claims were invented. Product photos and warranty information remain dependent on real inventory/settings. Unknown home-service transport remains subject to address review. No unsupported payment method, procurement flow, notification button or fake progress timeline was added.
