# Architecture and refactoring audit

## Structure

The application remains React, TypeScript, Vite, Firebase Auth/Firestore, and Three.js. It has nine feature folders and 17 source directories. This pass adds focused modules inside existing folders; it does not add nested controller/repository/provider scaffolding, dependencies, aliases, or a new state library.

| Location                 | Responsibility                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `src/App.tsx`            | Application providers and global stylesheet order                                            |
| `src/routes.tsx`         | Lazy pages, authentication gate, role-specific routes, legacy redirects, entry dialogs       |
| `src/components/layout`  | Sidebar, top bar, workspace shell and account/storage notices                                |
| `src/components/ui`      | Reusable presentation: dialogs, tables, fields, filters, feedback, confirmations             |
| `src/features/auth`      | Sign-in and registration UI                                                                  |
| `src/features/builder`   | Build configuration, compatibility, request approval, saved plans, 3D runtime                |
| `src/features/customer`  | Customer records, bookings, request subscriptions and mutations                              |
| `src/features/dashboard` | Workshop dashboard and charts                                                                |
| `src/features/finance`   | Sales, expenses, reports, invoice UI, payment proofs and financial summaries                 |
| `src/features/inventory` | Product editing, scanners, SKU identity and inventory mutations                              |
| `src/features/pos`       | Catalog/cart, checkout, order lifecycle, cashier collection and order QR                     |
| `src/features/services`  | Service workspace, request review, intake, schedules and visit pricing                       |
| `src/features/settings`  | Shop, service, account, reference-data and user settings                                     |
| `src/hooks`              | Shared subscriptions, workspace read facade, list filters and async action locking           |
| `src/lib`                | Firebase infrastructure, authentication, cross-domain rules, formatting and export utilities |
| `src/types.ts`           | Shared persisted business contracts                                                          |

Pages render feature views; feature hooks own local interaction state and call named operations. Operations use Firestore transactions and pure business helpers. Cross-feature imports use explicit leaf modules, not barrel exports. Shared UI receives business data through props. Relative imports remain short with this layout; aliases would add configuration without resolving a current problem.

## Audit findings and changes

| Before this pass                                                                     | Result                                                                                                           |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| App combined providers, routing, shell, notices and entry selection in about 15.5 KB | App is under 1 KB; routing and the shell have separate responsibilities                                          |
| POS combined state, products, payments, cart and checkout UI in about 52 KB          | Page is about 10 KB; `usePos`, `CartPanel`, `CheckoutDialog`, and `CollectPayment` own distinct responsibilities |
| PC builder contained persistence and workflow handlers in its page                   | `usePcBuilder` owns interaction logic; `buildPlans` owns saved-plan persistence; page renders controls           |
| Shared EntryForm switched between four business record types with broad casts        | Removed; typed `ServiceIntake`, `ExpenseEditor`, and the existing `InventoryEditor` handle their own records     |
| Feature operations and subscriptions accumulated in lib/hooks                        | Moved alongside their features, preserving APIs and updating source/test imports                                 |
| Database reference helpers imported React listener machinery                         | `lib/database` contains refs/serialization; `hooks/useLiveData` owns cached subscriptions                        |
| Business helper mixed financial summaries and spreadsheet generation                 | `finance/summary` calculates reports; `lib/excel` retains lazy spreadsheet generation                            |
| Hardware rules imported Lucide components                                            | Pure compatibility rules and `componentIcons` are separate                                                       |
| Some actions acquired busy state after confirmation                                  | Shared `useAsyncAction` acquires a synchronous lock before awaiting confirmation                                 |
| Numeric parsing converted a required blank to zero                                   | `formAmount` rejects blanks, non-finite and negative values; optional estimates can remain zero                  |
| Document subscription state was keyed only by path                                   | Key includes signed-in user; workspace remounts when identity or effective role changes                          |
| Workspace error/loading aggregation omitted payment proofs                           | Payment subscription failures/loading now participate in workspace status                                        |

The POS lookup for scanned orders now lives in `orderOperations.findPayableOrder`; it prefers an issued sale over the unpaid order and rejects missing/declined references. A request sequence prevents an older successful lookup from replacing a newer result. Existing stock, payment, quote and checkout transactions remain the authority.

The largest remaining modules are focused views/controllers of roughly 400–530 lines, including settings, the builder fallback, POS controller and checkout form. They are not split solely to meet a line limit. The adapted Three.js runtime remains intact.

## Moved modules

- POS: `checkoutOperations`, `orderOperations`, and the business-specific `OrderQr`.
- Inventory: `inventoryOperations` and `inventoryIdentity`.
- Finance: `expenseOperations`, `payments`, `usePayments`, and the extracted `summary`.
- Services: `serviceOperations`, `serviceCatalog`, and `visitPricing`.
- Builder: `buildOperations`, `buildReview`, `componentFields`, and `pc`.
- Customer: `customerOperations` and `useCustomerRequests`.

No compatibility wrapper files were left at the previous paths. Emulator/browser fixture imports were updated without running those suites.

## State, roles and workflows

Firebase owns persisted business data. Shared collection subscriptions are cached by authenticated user, collection and query key. Each constrained query supplies a key containing every changing constraint value. Document subscriptions are keyed by user and path. Effects return listener cleanup functions.

Cart, filters, dialogs, builder selections and form drafts remain local. Derived totals, stock availability and compatibility are computed from current records. POS uses a product lookup map when assembling invoice lines. Authentication and confirmation are shared context; no additional global store is introduced.

Routes distinguish customers from admins. Firebase profile resolution grants effective admin access only after verification. Role changes remount the workspace and clear its local state. Routes and client checks guide the UI; Firestore rules remain the authorization boundary.

Important workflow invariants remain:

- Inventory is the stock authority; catalog records are cost-redacted projections.
- Orders reserve inventory at confirmation; full verified payment consumes reservations and issues immutable receipts.
- Customer order/receipt projections exclude acquisition costs.
- Paid sales, private cost snapshots, orders, receipts and stock movements are different audit/access records.
- Service intake preserves linked appointment/customer/transaction identifiers. Paid/completed service records cannot be edited.
- Expense corrections retain audit history; voiding excludes a record from totals without deleting it.
- Recurring expenses require an explicit due-occurrence action.
- Build approval, quoting, owned-part handling and stock compatibility rules remain intact.
- Transaction reads precede writes; historical prices and warranty snapshots are preserved.

Shared domain rules stay in `workflow`, `commerce`, `fulfillment`, `stock`, `saleSnapshots`, `shopSettings`, `dates`, and `format`. Shared helpers may consume pure feature rules such as hardware classification or schedule adaptation. They must not depend on feature views or React controllers.

## Removed and retained

This pass removes the multi-purpose EntryForm and mixed business helper, plus the old locations of moved files. It removes dead branches for obsolete entry types and unused imports. It keeps the nine-domain structure established by the earlier folder consolidation.

The earlier cleanup removed the duplicate standalone 3D demo and generated output, unused React/Vite assets, obsolete wrapper pages, stale browser-local demo tests, superseded documentation, logs and empty scaffolding. The active 3D runtime, license, WebGL fallback, branding, local configuration and maintained test suites remain.

Installed dependencies are generated tooling, not source clutter. VS Code hides node_modules, Git internals and generated output and nests related root configuration files. Generated dist output was removed after the successful build. No business data, live Firebase records or local environment values were changed.

## Architecture checks and verification

ESLint prevents shared UI from importing features/workspace orchestration and prevents operation modules from importing React, components or UI hooks. The local architecture test resolves application imports, checks reachability and detects runtime cycles. TypeScript checks contracts across moved modules.

The local suite covers stock reservation/payment idempotency, cost redaction, receipts, booking capacity/rescheduling, SKU identity, recurring expenses, owned builds, compatibility and finance calculations. Added regression cases cover scanned-order lookup, saved-plan persistence and blank amount validation.

Verification for this pass: production build, full ESLint check and all 23 local checks passed. The import-graph check passed again after the final import changes; git diff whitespace checks also passed. CSS side-effect import order is preserved. No image preview, browser session, emulator suite, live write or deployment was used.

## Remaining verification and recommendations

Visual/device behavior, real authentication, deployed Firestore rules and production transactions are not certified by local tests. Existing browser/emulator suites remain available for a separately authorized release check. Email outbox delivery still needs an actual provider/worker; the current app does not claim delivery.

Keep new business changes beside their feature and add a shared abstraction only when there is a real common responsibility. For larger deployment needs, consider privileged server operations when a concrete server-only integration requires them. Further splitting of settings/controller files should follow a new responsibility, not folder or line-count targets. Vendor chunk warnings remain concentrated in Three.js, spreadsheet export and shared dependencies; those expensive features stay lazy-loaded.
