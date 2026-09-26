# Firebase account roles

Firebase Authentication stores sign-in credentials. Firestore stores each account's profile in `users/{uid}` with `name`, `email`, `createdAt`, and `role`. Public registration creates the profile with `role: "user"`.

User accounts currently do not require email verification. Registration does not send a verification email or display a verification prompt. Signed-in users can place orders, submit payment proofs, book services, save builds, and update their profile immediately. Email verification remains required for admin access.

## Set up and promote an administrator

1. Enable **Email/Password** in Firebase Authentication and create Cloud Firestore in the project configured by `.env.local`.
2. Publish [`firestore.rules`](firestore.rules) in **Firestore Database → Rules**. Merge rules for any other collections first, because publishing replaces the project's current rules.
3. Create an account through the website. In **Firestore Database → Data**, find its document in `users`. The document ID is the Firebase Authentication UID and its `role` is `user`.
4. As the database owner, edit that document's `role` field from the string `user` to the string `admin`. An unverified account will see an admin verification prompt: choose **Send verification email**, follow the link, then use **I verified my email** or sign in again. Admin access requires a verified email; subsequent role changes are picked up while signed in.

To revoke access, change `role` back to `user`. The app listens for server-confirmed role changes and switches the account to the user portal. Firestore rules require both a verified email and `users/{uid}.role == "admin"` for admin-only reads. A signed-in user can update their own profile details, but the rules only allow public account creation with the user role and block client-side role changes. A Firestore project owner can edit roles directly in the Firebase console or through a trusted server using the Admin SDK.

## Existing accounts

Older profile documents without a `role` field are treated as users. On the next sign-in or account refresh, the app adds `role: "user"`; an owner can then promote one in Firestore. The old `config/adminAccount` UID document and any earlier `config/ownerAdmins` roster or `admin` custom claim no longer grant access. If the former company admin should keep access, add `role: "admin"` to that account's `users/{uid}` document.

## Current business data

The application now uses Firestore for account profiles, roles, inventory, the public catalog, bundles, jobs, expenses, sales, online orders, appointments, PC requests, saved builds, directories, shop settings, and personal account settings. Sidebar collapse is a device-only display preference.

The database starts empty. Existing browser records are not imported. Create the first inventory items and shop settings from an admin account after publishing the rules. Admin inventory writes also create safe public catalog records; do not edit `catalog` directly in the Firebase console. Online orders are requests until an admin uses **Prepare order in POS** or sets **Processing** or **Ready**. The app then checks current prices and stock, creates a sale, and reserves the stock. Declining an unprocessed request does not reserve stock. If prices or rates changed, ask the customer to place a new order or decline the request. **Completed** requires full payment and confirms pickup.

Publishing rules does not delete existing Firestore documents. No sample records or browser migrations run automatically. Directory choices and unset shop defaults remain available before their first save.

### Collections

| Path | Access |
| --- | --- |
| `users/{uid}` | Owner profile; admins can list profiles; only the database owner changes roles |
| `users/{uid}/settings/account`, `users/{uid}/plans` | Account owner only |
| `settings/shop`, `settings/directories`, `catalog`, `bundles` | Signed-in reads, admin writes |
| `inventory`, `jobs`, `expenses`, `sales` | Admin only |
| `orders`, `appointments`, `pcRequests` | Customers see their own records; admins process all requests |
| `paymentAccounts/bank`, `paymentAccounts/ewallet` | Signed-in reads; admins configure company QR images; empty and disabled by default |
| `paymentProofs/{orderId}` | Customer can submit their own proof or replace a rejected proof; admins verify or reject |
| `receipts/{receiptId}` | Immutable payment snapshots created by admins; customers can read their own receipts |
| `receiptEmails/{receiptId}` | Prepared email outbox; admin-only reads and creation; a future trusted email backend manages delivery |

Customer order records omit inventory costs. Payments, stock deductions, order processing, and appointment-to-job creation use Firestore transactions. Transactions require a connection; write failures are shown in the form. Product and profile photos are limited to 500 KB and stored with their documents.

### Cash, order QRs, and pickup

1. Customer checkout creates an **unpaid pickup order**, saves the receipt email, and generates an order QR. It does not charge the customer or reserve stock.
2. In POS, staff use **Scan order QR** with a camera, uploaded QR image, USB scanner, or typed reference. Scanning only opens the order; it does not record payment.
3. **Prepare order in POS** checks current prices and reserves stock once. Staff can also open orders from **Service jobs → Customer requests & online orders → Open POS**.
4. Staff record cash received. Partial payments are supported; overpayment becomes change. Each payment atomically saves an immutable transaction receipt, prepares an email when an address is supplied, and updates both the private sale and customer order.
5. After full payment, **Confirm pickup** marks the order Completed. Reopening a paid or completed order does not collect another payment or deduct more stock.

Customers use **My records → Orders → QR / receipt** to view their order QR and print or save a receipt as PDF. An unpaid order slip is identified as payment pending. No payment gateway or online card processing is configured.

### Future company bank and e-wallet QRs

The two slots in **Workspace settings → Company payment QRs** start blank. No real or sample bank account is seeded. Add your provider, account holder, optional account number, and QR image (JPG/PNG/WebP, up to 500 KB), then enable the option when ready. An empty or disabled slot is unavailable to customers.

When enabled, the customer can view the company QR in their order details, transfer using their own banking/e-wallet app, and submit a reference plus proof image (up to 500 KB). Submission leaves the order unpaid. Staff open **Proof awaiting review** orders in POS, compare the reference and amount with the actual company account, then choose **Verify transfer and issue receipt**, or **Reject proof** with a reason. A rejected proof can be resubmitted. Pending proof blocks cash collection until staff reviews it, avoiding recording cash on top of an unreviewed transfer. A verified proof cannot be submitted again.

### Prepared receipt emails — delivery setup deferred

Email sending is intentionally not enabled yet. For each payment with a receipt email address, the same Firestore transaction creates `receiptEmails/{receiptId}` containing:

- `receiptId`, `orderId`, `customerId`, `to`, `createdAt`, and `status: "Queued"`.
- `message.subject`, `message.text`, and escaped `message.html` with the itemized transaction, payment method/reference, total paid, and remaining balance.

These are prepared messages, not delivered emails. The website states this and lets the customer print or save the receipt immediately. There is no email provider, sender address, or password configured in the frontend. A later trusted backend must connect the chosen provider, use the receipt ID to prevent duplicate delivery, and track sending, delivery errors, and retries with server credentials. Decide whether to send previously queued receipts when enabling that backend. Client rules intentionally prohibit marking outbox messages as sent; the trusted backend will use the Admin SDK.

Publish the updated `firestore.rules` manually before using these features on the live project. Publishing rules alone does not configure email delivery.

### Local verification

With Node dependencies installed, Firebase CLI and Java 21 or newer available on PATH:

```sh
npm run test:rules
npm run test:database
npm run build
```

`npm test` runs both database test suites. `npm run test:legacy` retains the older browser-storage test runner for reference.

The rules tests check role enforcement, customer data isolation, proof review restrictions, receipt immutability, and outbox access. The browser test uses Microsoft Edge and separate customer/admin sessions against local Auth and Firestore emulators. It covers registration, role changes, catalog publication, QR scanning, partial/full cash payments, pickup, manual proof rejection/resubmission/verification, prepared emails, appointments, settings, saved builds, and PC quotes. Both commands use `demo-jbc-rigworks`; they never seed or clear the live project. Synthetic company QRs exist only in the disposable emulator test. The older browser-local Playwright suites use the retired storage format and are not database integration tests.
