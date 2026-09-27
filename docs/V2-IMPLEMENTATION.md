# JBC RigWorks V2 implementation

The section-by-section reconciliation is in [V2-CHECKLIST.md](V2-CHECKLIST.md). It distinguishes source implementation from deferred production/visual checks and optional integrations.

## Audit (2026-09-26)

The existing app uses React 19, TypeScript, Vite, React Router, Firebase Auth and Firestore. There is no Zustand store. Hooks subscribe to Firestore. The Three.js builder is already dynamically imported; its generic meshes and interaction controls are retained.

Inventory is already the master product source. `catalog` is a public, cost-redacted projection of inventory with identical document IDs, not a second stock authority. The former PC Parts Directory edits these same inventory records. It can be retired from navigation without moving or deleting products. `orders` is the customer-safe view of online transactions; private `sales` and immutable `receipts` retain financial snapshots.

Observed problems: anonymous schedule strings; hardware-tier cleaning prices; arbitrary status edits; cancellation deletes requests; confirmation deducts stock and recognizes unpaid orders; service payment implicitly releases devices; customer checkout forces pickup/cash; duplicated settings; permanent customer cart; dialogs with footer inside scrolling columns; duplicate subscriptions; raw database errors.

## Compatibility policy

No existing collection or historical record is deleted. Legacy status and pricing fields remain readable. New writes add schema version 2, explicit reservation/payment state, audit metadata, and linked record IDs. Legacy unpaid sales remain accessible but are excluded from recognized revenue. A legacy online sale that already deducted stock must never deduct it again.

`settings/shop.services` replaces cleaning tiers for new bookings and POS service selection. Legacy prices are adapted to named packages only when no V2 catalog exists; admin must review package descriptions and prices. `settings/shop.schedule` defines operating days/windows/capacity/blocks. Appointment slot documents contain counts only, no customer data. Confirming bookings is transactional.

## Implemented workflows

- **Services:** a shared service catalog replaces hardware-tier choices. Workshop/home booking uses configured windows, duration, blocks, and confirmed capacity. Confirmation reprices from trusted settings. Check-in creates one linked job. Intake, work, checkout, and release are separate actions. Service prices are stored before tax; checkout applies tax once. Payment does not release the device.
- **Shop and POS:** customer filters and a cart dialog replace the permanent cashier layout. Pickup and flat-rate delivery are supported. POS derives the sales channel, requires full payment, records cash/change or explicit transfer verification, and writes immutable receipts. Online orders reserve at confirmation and consume stock at payment. Opening an order from the POS queue stays in the cashier workflow.
- **PC Builds:** the existing Three.js viewer remains. Inventory and customer-owned components share selection, labels, and compatibility checks. Saved plans and quote requests do not reserve stock. Customer approval precedes reservation, assembly, payment, and completion. Owned components do not add inventory cost or consume stock. Missing specifications remain flagged for review.
- **Inventory and bundles:** Inventory is the catalog authority. Forms separate basic, pricing, compatibility, presentation, and warranty fields. Stock adjustment requires a reason and preserves reservations. Inventory QR scanning opens the stock-adjustment flow; order QRs belong in POS. Bundle management lives in Inventory; Shop/POS only select published bundles. Bundle prices and optional free delivery are applied centrally.
- **Records and reporting:** Sales is a ledger, expenses retain edit/void history, and reports recognize fully paid sales with historical COGS. Reports include date ranges, payment methods, channels, item categories, daily paid totals, expenses, gross profit, and net profit. Item category reports use saved line categories; old lines without categories remain labeled as legacy rather than being rewritten.
- **Navigation and settings:** duplicate parts-directory UI was removed and old routes redirect to Inventory or the builder. Reference data, service packages, booking schedules, delivery, warranty, taxes, and payment accounts are grouped in Settings. Referenced inventory/expense directory values cannot be renamed or deleted through the editor and can be deactivated for future forms.
- **Shared UI and loading:** dialogs have one scrolling body and a fixed footer where needed. The workspace has one main scroll area. Page modules, settings, Three.js, scanners, and Excel export load on demand. Collection subscriptions are shared by signed-in user and query.

### Final workflow refinements (2026-09-27)

- Payment-proof submission explicitly marks the order **Pending verification**; rejection records **Rejected** and permits resubmission. Neither action recognizes revenue, deducts stock, or issues a receipt. Order confirmation preserves pending proof state, and pending build transfers must be reviewed before cancellation. The order rules permit a customer to change only this payment-status field when the matching proof is pending in the same resulting database state.
- Admin build review shows current and submitted prices, inventory/customer-owned sources, availability, missing components, estimated power, and compatibility results. Shared `buildReview.ts` checks are reused by quoting and reservation. Known incompatibilities block quotes and reservations; reservation also rejects duplicate component selections and incorrectly categorized inventory.
- Inventory scanning now opens `StockMovementHistory.tsx`, which reads the immutable ledger and shows on-hand and reserved quantities, reasons, references, timestamps, and operators. Legacy embedded entries remain visible. The list displays 30 entries at a time; the subscription currently loads the full item ledger.
- Product details include relevant compatibility specifications, warranty, stock, and an add-to-cart action. Service-only POS transactions omit product delivery and warranty controls, and their saved sales omit product fulfillment. Service intake can begin with a pending estimate; paid services cannot be edited.
- Reference-data rename/delete checks also inspect jobs, sales lines, appointments, and build requests. Editors wait for those records to load before allowing changes.

## Main modules

### Remaining-work continuation (2026-09-27)

- **Appointment review:** `AppointmentReview.tsx` and `reviewAppointment` add admin schedule/estimate changes with a review note and retained prior values. Confirmed appointments release the old slot and acquire the new slot in one transaction, including full-slot checks. The reviewed pretax estimate feeds service intake. Customer records display the review. Cancellation metadata is now recorded for requested appointments as well as confirmed appointments, orders, and builds.
- **Expenses:** vendor/payee, receipt reference, notes, and monthly/yearly frequency are editable. Date/payment/frequency filters and exports include these fields. `expenseOperations.ts` creates one due occurrence only after staff confirm payment, uses a deterministic series/date ID to reject duplicates, clears the old receipt reference, and records the operator. Calendar dates clamp to the last valid day of the next month/year. There is no background generation of expenses.
- **Inventory identity:** `inventoryIdentity.ts` checks legacy SKUs against server inventory and claims a normalized `inventorySkus` document in the inventory save transaction. Concurrent V2 claims for the same SKU conflict. Renaming releases the old claim. New rule checks require a matching claim on creation/identity changes; unchanged legacy stock updates remain supported. Deactivated products retain their identity.
- **Build approval:** admins can explicitly record approval obtained from a customer, including evidence/conversation notes. The transaction checks the current quote timestamp to avoid approving a changed quote. Approval does not reserve parts.
- **Reports and navigation:** service target-date cohorts, build creation-date cohorts, dated stock movement counts, and current low stock complement financial reports. These are current statuses of records in the stated cohort, not historical transition counts. Dashboard service links open the corresponding status filter.
- **UI completion:** bundle photos and limiting-component quantity, explicit out-of-stock/inactive labels, and reusable card/table loading placeholders were added. No image preview or visual browser run was used to review them.

New optional record fields: `InventoryItem.skuKey`; appointment `reviewedEstimate`, `reviewNote`, `scheduleHistory`; expense `vendor`, `reference`, `notes`, `recurrence`, `recurringSourceId`; build `approvedAt`, `approvedBy`, `approvalNote`; sale `cancelledAt`, `cancelledBy`. These do not rewrite old financial snapshots. `inventorySkus` is an admin-only identity index, not another stock collection. Existing duplicate legacy SKUs must be corrected before those items can claim their identifiers. Legacy records migrate on their next save; no live bulk migration was run.

| Area                        | Files                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| State transitions and stock | `src/lib/workflow.ts`, `src/lib/stock.ts`, feature-local order/service/build operations                                                         |
| Catalog, pricing, settings  | `features/services/serviceCatalog.ts`, `visitPricing.ts`, `lib/shopSettings.ts`, `lib/fulfillment.ts`, `features/builder/componentFields.ts`    |
| Data and checkout           | `src/lib/database.ts`, `hooks/useLiveData.ts`, `hooks/useWorkspace.ts`, feature-local operations, `lib/excel.ts`, `features/finance/summary.ts` |
| Feature UI                  | `src/features/customer`, `services`, `builder`, `inventory`, `pos`, `finance`, `settings`                                                       |
| Shared shell                | `src/App.tsx`, `src/routes.tsx`, `components/layout/WorkspaceShell.tsx`, `components/ui/Dialog.tsx`, `styles/v2.css`                            |
| Types and access            | `src/types.ts`, `firestore.rules`                                                                                                               |

## Schema additions

| Record                | Additions and meaning                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inventory             | `reserved`, `active`, compatibility dimensions, sockets, interfaces, power and clearance fields. Available stock is on-hand minus reserved.                                                                              |
| `stockMovements`      | Immutable item/reference/user/time entries with on-hand and reservation quantities before and after each movement. Embedded history retains the latest 100 movements for quick display.                                  |
| `orderSnapshots`      | Admin-only pending-order line and cost snapshots. These are not recognized sales.                                                                                                                                        |
| Orders and sales      | `schemaVersion: 2`, reservation/payment state, created/paid timestamps, service/build links; invoice lines retain category, price, cost, and warranty snapshots.                                                         |
| Payments              | Transfer account, reference, verifier and verification time. Customer proofs remain separate until an admin verifies them; order payment status reflects Pending verification or Rejected without changing paid amounts. |
| Appointments and jobs | Service ID, specifications/unknown flag, linked appointment/job/transaction, slot reference, cancellation metadata, intake details, explicit service/payment state.                                                      |
| `appointmentSlots`    | Date/window/count records, without customer identity. Capacity is checked in the confirmation transaction.                                                                                                               |
| PC requests           | Component source and compatibility snapshot, quote/approval workflow, reservation state, linked transaction.                                                                                                             |
| Expenses              | Creation/edit user and timestamps, prior snapshots in audit entries, and a retained void flag.                                                                                                                           |
| Settings              | Service offerings and scheduling configuration; directory `inactive` values; payment account visibility for customers/POS.                                                                                               |

No bulk migration or live database write was performed. Missing `reserved` reads as zero. Legacy service statuses map to the new stages for display and progression. Existing paid receipts and prices are not recomputed. Legacy unpaid sales remain visible and can collect their remaining balance without repeating an old stock deduction. Older appointment time labels may need customer rescheduling to a current window before confirmation. Legacy cleaning prices only seed the new catalog; package names, inclusions, durations, and rates need workshop review.

## Verification

- Final production TypeScript/Vite build passed on 2026-09-27. Heavy Three.js, ExcelJS, and shared vendor chunks still produce Vite size warnings; they are not build errors.
- Final lint and `git diff --check` passed. No image previews or browser checks were run during this final refinement pass.
- The earlier 14 local logic/transaction-simulation tests passed. The remaining-work continuation ran only the focused transaction file: **10 tests passed**, including rescheduling/slot transfer, recurring-expense date and duplicate handling, and SKU claims. Existing cases cover proof submission/rejection/resubmission, reservations, payment/receipt snapshots, duplicate payment rejection, cancellation release, price tampering, transfer verification, owned builds, booking capacity, idempotent check-in, and service tax. The simulation checks transaction read/write ordering but does not emulate Firestore access rules or distributed concurrency. Later approval-note and loading-display additions receive build/lint checks only.
- Isolated browser checks passed at 1440, 1024, 768, and 390 pixels for ten main routes, checkout/booking dialogs, main-page overflow, and Three.js rendering. These use test-only data/auth adapters and make no business database calls. Later small reporting/workflow edits receive static checks only, following the request to limit tests and stop image previews.
- Firebase emulator tests were skipped at the user's request. `test:integration`, `test:rules`, and `test:database` start emulators and were not run. The default `npm test` now runs the local logic suite only. Live authentication, deployed rules, email delivery, physical camera scanning, and end-to-end production transactions are not certified by the local checks.

Local checks are available as `npm run test:logic` and `npm run test:ui`; neither starts Firebase emulators. The UI fixtures are enabled only by `tests/ui/vite.config.mjs`, not the production Vite configuration.

## Setup and remaining limitations

1. When releasing, deploy the frontend and revised Firestore rules together. New transactions require access to the new stock, slot, and private snapshot collections. No deployment was performed in this task.
2. Review and save the Service Catalog and Booking & scheduling settings. Confirm operating days, windows/capacity, blocked dates, visit modes, and prices. Review old appointments before changing their schedule windows.
3. Configure business identity, tax/fee defaults, delivery, home-visit rates, warranty terms, and company payment accounts. Upload real account QRs and enable their customer/POS visibility. Transfers still require a human to check the company account.
4. Receipt email outbox records remain queued until a real email worker/provider is connected. Printing and PDF saving work independently. No automatic bank verification or payment gateway is claimed.
5. Refunds, returns linked to refunds, staff-specific permissions, supplier purchasing, and automated notifications are not implemented as new subsystems. Paid cancellation is blocked pending a deliberate refund workflow. Existing roles remain customer/admin.
6. Compatibility uses the specifications available in Inventory and the customer's entries. BIOS support, exact power transients, and manufacturer-specific fit still need workshop review. Product/QR images remain size-limited Firestore data images; a dedicated object-storage pipeline was not introduced.
7. Business transitions run in shared client transaction services under verified admin access. Rules enforce ownership, selected numeric invariants, SKU claims and retained/immutable records; no privileged backend transaction API was added. The SKU index protects V2 saves, with server-read legacy checks. Deploy rules and frontend together; older clients cannot create unclaimed inventory after the new rules deploy. No rule emulator verification was performed.
8. Review the new 104-section checklist before release. Actual business values and payment account images must come from the workshop; this task does not invent or publish those values. Live authentication and hardware scan checks require real test accounts/devices. The repository currently has Firestore configuration but no Firebase Hosting target configured, so release hosting must be selected or connected separately.

## Repository organization

The cleanup separated subscription hooks into `src/hooks` and transaction mutations into named domain-operation modules. Shared types, dates, formatting and customer-safe sale snapshots have dedicated modules. Obsolete wrapper pages, template assets, the standalone 3D demo, retired local-storage tests and obsolete frontend/setup documentation were removed. The live 3D runtime and its license/fallback remain. See [ARCHITECTURE.md](ARCHITECTURE.md) and [FIREBASE-SETUP.md](FIREBASE-SETUP.md) for current paths and commands. No database schema or live data was changed by this cleanup.
