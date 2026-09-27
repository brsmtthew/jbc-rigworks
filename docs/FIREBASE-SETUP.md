# Firebase setup and release

## Authentication

Copy `.env.example` to `.env.local` and configure the Firebase web app. Enable email/password authentication in the project's Authentication settings and add the actual development/production domains to its authorized domains. This repository does not include server credentials.

Public registration always creates a customer profile in `users/{uid}`. Use a trusted project-owner process (Firebase console or privileged administrative tooling) to assign an existing account the `admin` role. The user must verify their email before the app and rules grant admin access. The website does not expose public admin registration or customer-driven role promotion.

## Release together

Publish the frontend and revised `firestore.rules` as one coordinated release. New code requires the slot, SKU-claim, stock-ledger and private-snapshot collections. Old clients cannot create unclaimed inventory after the new SKU rules are deployed. The repository does not select or configure a Firebase Hosting target.

Deploying rules does not delete data. Legacy records remain readable; optional fields use adapters/defaults. Review existing duplicate SKUs before editing affected items. SKU claims are created when an item is saved; no automatic bulk migration is performed.

## Collections

| Collection                                          | Purpose / access                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `users/{uid}`                                       | Profile and protected role; customer can update permitted own-profile fields |
| `users/{uid}/settings/account`, `users/{uid}/plans` | Owner-only settings and saved builds                                         |
| `settings/shop`, `settings/directories`             | Signed-in reads; admin writes                                                |
| `inventory`, `inventorySkus`                        | Private master inventory and unique-identity claims                          |
| `catalog`, `bundles`                                | Customer-readable product projection and published selection data            |
| `stockMovements`                                    | Admin-readable immutable stock/reservation ledger                            |
| `appointments`, `pcRequests`, `orders`              | Customer-owned records, administered by the workshop                         |
| `appointmentSlots`                                  | Customer-readable counts without customer identity                           |
| `jobs`, `expenses`, `sales`, `orderSnapshots`       | Admin operational/financial data and private costs                           |
| `paymentAccounts`, `paymentProofs`                  | Configured transfer accounts and customer-owned proofs                       |
| `receipts`                                          | Immutable customer-safe payment snapshots                                    |
| `receiptEmails`                                     | Prepared outbox records; sending is not configured                           |

## Business setup

Review service packages, durations, opening days/windows/capacity, blocked periods, tax/fee defaults, delivery/home-service charges, warranty and invoice identity. Use actual workshop values. Configure real company payment accounts/QRs and enable their customer/POS visibility as appropriate.

Online requests reserve stock when confirmed and consume that reservation only when full payment is recorded. POS does not support normal partial/credit sales. Transfer proofs remain pending until a staff member verifies the real account transaction. Device/build completion is a separate workflow action.

## Optional receipt email delivery

Payment transactions can create a `receiptEmails/{receiptId}` record containing destination, receipt reference, message subject/text/HTML, timestamp and Queued status. This is an integration abstraction, not a claim that email was sent.

A trusted backend must connect the selected provider, protect credentials, deduplicate by receipt ID, and record delivery/retry/error state. Client rules do not permit changing an outbox item to Sent. Decide explicitly whether enabling delivery should send previously queued receipts. Customers can print/save receipts independently.

## Verification

`npm test` runs only local logic tests. `npm run test:integration` explicitly starts Firebase emulators for rules and database tests; it requires the Firebase CLI and a compatible Java installation. `npm run test:ui` uses isolated fixtures and a browser. Neither emulator nor visual suites were run during repository cleanup.

Live sign-in, deployed access rules, hardware scanning and production transactions remain release checks. Do not use the production database for disposable test data.
