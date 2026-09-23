# JBC RIGWORKS Business Hub

Private business workspace for service jobs, sales and payments, inventory, operating expenses, and monthly reports. Currency: PHP. Business dates: Asia/Manila.

## Main workflows

- Add opening inventory or a paid stock purchase. Restocking updates weighted average costs.
- Record service and product lines together. Product stock and cost of sales update atomically.
- Record full or partial payment, then collect the outstanding balance later.
- Track customer jobs and convert a job to a sale. Quotes are not counted as revenue.
- Record paid operating expenses. Stock write-offs are non-cash expenses.
- Review profit before tax, recorded cash movement, and receivables. Export current views as CSV.

Sample data is display-only and never inserted into the business database. Real records use the Sites D1 database. Access is restricted by the Site's owner-only platform policy.

## Accounting scope

Stock uses weighted average cost at the time of sale. Financial values are stored as integer centavos. Purchases and direct service costs are assumed paid on their recorded dates. Opening inventory does not count as new cash outflow. Only unpaid sales may be voided; voiding restores their inventory. Paid-sale refunds, tax calculations, official invoices, owner contributions, withdrawals, borrowing, and bank reconciliation are not implemented. Inventory corrections use a paid restock or a stock write-off.

## Validation

Application type checking and production build pass. Isolated tests run the actual API handlers against SQLite using the generated schema. Twenty-four checks cover weighted stock costing, cash flow versus profit, partial payments, duplicate submissions, job-to-sale conversion, concurrent stock guards, overselling, invalid dates, unpaid reversals, and cross-site write rejection.

The browser preview was inspected with empty and display-only sample data. Browser insertion of a test record was blocked by automatic approval review, so no such test records were saved. Browser WebMCP validation was unavailable because the preview browser did not expose modelContext. The tools are feature-detected and do not affect normal interaction.

## Project

Built with the bundled Sites Vinext starter, React, TypeScript, Shadcn, and Cloudflare D1. Primary interface: `app/business-hub.tsx`; entry forms: `app/hub-forms.tsx`; API: `app/api/workspace/route.ts`; business calculations: `lib/business.ts`; schema: `db/schema.ts`. Preserve the project identity in `.openai/hosting.json` and use the Sites build/publish workflow.
