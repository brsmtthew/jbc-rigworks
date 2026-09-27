# JBC RIGWORKS — Login and Customer Website Redesign Prompt

Copy the prompt below into your coding assistant with the current repository open. Attach the original screenshots and generated UI concepts when available. The concepts show visual direction; the existing application and the requirements below govern functionality.

---

Act as a senior UI/UX designer, product designer, and frontend engineer. Redesign and implement the login experience and customer-facing pages of my existing JBC RIGWORKS business website. Deliver a cohesive, professional, responsive customer experience with clear actions, readable content, and improved workflows.

First inspect the repository, its instructions, routes, components, styling, authentication, state management, data services, and existing 3D integration. Work within the current stack and preserve functioning integrations. Then implement the redesign in manageable stages. Do not stop at suggestions or a static mockup.

## 1. Scope and non-negotiable requirements

- Scope: sign in, registration, password recovery, customer dashboard, services and booking, workshop/home-service requests, PC Builder, component selection, saved builds, build summary and quote requests, shop, product details, cart and existing checkout, My records, profile/contact, and display/account settings.
- Admin redesign is a later phase. Shared components must continue to work for administrators; keep shared authentication and role-based routing intact.
- Preserve the original JBC RIGWORKS logo, navy/blue identity, and slogan “PC & Laptop Care Done Right.” Use existing assets without stretching, redrawing, or substituting the logo.
- CRITICAL: Preserve the existing LIVE INTERACTIVE 3D PC MODEL. Keep its assets, geometry, materials, scene, lighting, camera behavior, component mapping, and event integration unless a narrowly scoped fix is necessary. Do not replace it with a screenshot, generated image, stock model, video, or new PC case.
- Preserve orbit/rotation, zoom, reset, glass/side-panel control, exploded view, labels, component selection, and the connection between selected products and labels. Preserve all additional behavior discovered in the code.
- Improve the layout around the 3D viewer. A generated mockup is not a replacement asset for the live viewer.
- Preserve existing data, IDs, authentication, inventory, appointments, orders, quotes, pricing rules, saved builds, exports, and permissions. Do not invent products, availability, warranties, testimonials, service inclusions, or business promises.
- UI concepts may contain illustrative copy. Live data and verified business rules take precedence. Identify any missing backend capability rather than simulating a successful transaction.

## 2. Screenshot findings to address

The screenshots show the following design issues. Confirm technical causes in code before calling them functional bugs:

- Login has a very large marketing headline and logo panel, while the form repeats sign-in/create-account navigation. The copy also mentions managing a workshop in a customer-facing experience.
- Dashboard summaries and empty states occupy excessive height. “Total spent” has more emphasis than the customer's next action.
- The page-title region covers portions of cards while scrolling in Dashboard and PC Builder screenshots. Inspect sticky positioning, offsets, scroll containers, and stacking.
- Service cards have nearly identical descriptions, making package differences hard to assess.
- Booking moves between a location dialog and a long details dialog, without a clear visible step sequence or back action.
- PC Builder repeats component selection, subtotal, progress, and summary information across multiple panels, while useful controls fall below the viewer.
- The processor-selection screenshot shows source buttons but no explanatory content below them. Verify initial selection, loading, empty inventory, and validation states.
- Shop has three dropdowns all displaying “All” without visible identifying labels. Product presentation lacks a useful visual area and a strong detail/action hierarchy.
- Empty cart copy mentions services; verify whether this cart actually supports service checkout or whether bookings are separate requests.
- Appointment history uses large nested cards and icon-only view actions. Status text is small and easy to miss.
- Profile and settings require several dialogs. The sign-in email resembles an editable input despite explanatory text describing it as an account identifier.
- Several helper labels and status texts are very small. Use readable text and accessible contrast.

## 3. Visual system

Create a restrained, premium PC-service brand experience: navy navigation, royal blue primary actions, pale neutral canvas, white surfaces, clear typography, and subtle technical imagery where useful.

Suggested starting tokens, adjusted to existing brand assets and verified for contrast:

| Token | Proposed value/use |
| --- | --- |
| Brand navy | #06264D; navigation and key headings |
| Primary blue | #0866DC; primary actions and selection |
| Canvas | #F4F7FB |
| Surface | #FFFFFF |
| Main text | #102A43 |
| Secondary text | #52657A |
| Border | #DCE4ED; neutral rather than blue outlines everywhere |
| Spacing | 4, 8, 12, 16, 24, 32, 48px |
| Corners | 10–14px for panels; 8–10px for fields/buttons |

Use the existing suitable font or one consistent legible sans serif. Body text should normally be 15–16px, labels 13–14px, page titles 28–32px, and section headings 18–22px. Avoid tiny all-caps text for essential information. Use consistent line icons, low shadows, content-driven card heights, and clear primary/secondary/tertiary action styles.

Avoid excessive gradients, glass effects, glowing RGB decoration, oversized pill buttons, repeated outlined boxes, unnecessary marketing banners inside transactional pages, and animations that delay tasks.

## 4. Shared customer layout and navigation

- Retain the recognizable primary navigation: Dashboard, Services & booking, PC Builder, Shop, My records. Profile and settings remain accessible from the account menu.
- Use an approximately 232–248px desktop sidebar with a compact logo area, clear active route, and accessible collapse control. Collapsed items need labels available through tooltips and accessible names.
- Use one compact top bar, approximately 64–72px high. Show a breadcrumb/context label and account menu. De-emphasize the large clock and move sign out into the account menu. Do not add nonfunctional notification or search controls.
- Show each main page title once. Prefer a scrolling page heading beneath a sticky top bar. Sticky content must never obscure headings, cards, keyboard focus, or actions.
- Use one primary document scroll area for ordinary pages. A dialog or desktop builder selection panel may have a deliberate contained scroll region, with no scroll traps.
- Use 24–32px desktop page padding, 16px mobile padding, and a sensible centered content width. Let PC Builder use the available workspace width.
- On mobile, use an accessible navigation drawer and a compact header. Preserve all customer destinations and actions.

## 5. Sign in, registration, and recovery

- Desktop: balanced two-column layout, approximately 45% navy branding and 55% light form surface. Use a smaller logo and concise headline such as “Your PC. In good hands.” Supporting copy: “Book a service, track your orders, and plan your next build.”
- Keep decorative technical line art lightweight. Do not mount the interactive PC Builder just to decorate login.
- Make the form approximately 400–440px wide. Use “Welcome back,” clearly labelled email/password fields, an inline password-visibility button, a nearby recovery link, and a full-width “Sign in” button.
- Use one clear link to switch between sign in and create account, eliminating duplicate tab/footer navigation. Preserve keyboard and browser navigation behavior.
- Remove customer-irrelevant admin instructions from the visual layout while keeping the shared sign-in mechanism functional.
- Registration: collect the existing required fields only, show actual password requirements, provide inline errors, and preserve values when validation fails. Do not add unnecessary registration steps.
- Password recovery: complete the actual recovery flow using the existing provider, with submitting, success, error, and retry states. Do not falsely indicate an email was sent.
- Support autofill, password managers, Enter submission, visible focus, and correctly named fields. Browser autofill is allowed; do not ship prefilled sample credentials.
- On mobile, condense the brand panel into a small identity header and prioritize the form. Allow scrolling with the keyboard open.

## 6. Customer dashboard

Design around “What should I do next?”

- Use a friendly greeting and clear actions: “Book a service,” “Build a PC,” and “Shop parts,” with one primary visual emphasis.
- Use compact summary cards for active appointments, PC requests, and orders. Each links to its corresponding records view.
- Clearly distinguish total appointment history from active appointments. The screenshots show two historical appointments, including a cancellation; an active count must exclude cancelled records according to the actual status model.
- Make the next relevant appointment prominent: service, device, requested/confirmed date and time, location mode if available, readable status badge, and “View appointment.”
- “Requested” must remain visibly different from “Confirmed.” Include short wording that explains whether the customer is waiting for JBC.
- Use concise recent-order and PC-request sections. Empty states need a small icon, one helpful sentence, and a relevant action; avoid large empty fixed-height panels.
- Move total spending to a secondary account/history context if useful, using the existing payment calculation. Never confuse submitted order value with received payments.
- Show real loading, empty, populated, and failed states without briefly presenting zeros during data loading.

## 7. Services and booking

- Add clear service filtering/grouping for Desktop and Laptop and, where supported by existing data, service categories such as cleaning, repair, upgrades, and assembly.
- Build consistent package cards: service name, device type, actual duration estimate, verified inclusions, price/estimate label, and “Choose service.”
- Make genuine package differences easy to compare. If inclusions are missing in source data, identify the content gap; never invent inclusions or “Most popular” claims.
- Retain the existing service catalog and actual prices. Do not reinterpret estimate prices as fixed guaranteed charges.
- Replace disconnected booking dialogs with one coherent flow: Service → Location & device → Schedule → Review. It may be one responsive dialog or a dedicated page, depending on existing routing.
- Preserve Workshop and Home service. Clearly explain drop-off versus a visit and show address fields only for home service.
- Keep device brand/model, optional specifications, “I'm not sure about my specifications,” concerns, preferred date/time, and the existing address information.
- Prefill available profile contact/address data without silently overwriting edits. Request missing contact details only where required by the existing booking process.
- Provide Back and Continue actions and a visible current step. Preserve entries when going back or changing service location.
- Validate required fields, dates, and available time slots with the real scheduling source. Handle unavailable slots and request failures explicitly.
- Review screen: service, device, location, contact, preferred schedule, concerns, and clear price breakdown.
- For home service, show the known service estimate separately from home-service/transport fees awaiting review. Unknown fees must not display as zero or become part of a misleading “final total.”
- Preserve “Your time is a request until JBC confirms. No payment is collected now” if it matches current workflow.
- Use “Submit booking request” for the final action. Prevent duplicate submissions. Only show success after persistence succeeds, then display reference/status and “View appointment.”
- Offer cancellation/reschedule actions only where the current backend and status rules allow them; explain unavailable actions without fabricating support.

## 8. PC Builder — preserve the model, redesign the workspace

This is a priority feature. Keep the current live model central to the experience.

- Desktop: a compact heading followed by a two-column workspace, roughly 60–65% viewer and 35–40% configuration. Keep selected parts and pricing visible beside the model on ordinary laptop screens.
- Remove the oversized introductory wrapper and consolidate the repeated component-selection grids and subtotal panels into one authoritative configuration UI.
- Size the viewer responsively without distorting the canvas or changing the model to match a generated concept. Recalculate renderer/camera aspect after resizing or sidebar changes.
- Preserve Reset, Zoom out/in, Orbit, Glass, Explode, and Labels. Provide readable names/tooltips, selected states, keyboard-accessible buttons, and unobtrusive interaction hints.
- Keep all eight existing categories: Processor, Motherboard, Memory, Graphics card, Storage, Power supply, Case, Cooling. Do not change the established slot/data model during styling.
- Selecting a model hotspot and selecting the matching list row must open the same component picker. A successful selection updates the model label, row, progress, and subtotal together.
- Each compact component row shows category, selected product or “Not selected,” source, relevant price, and Add/Change/Remove actions.
- Clearly mark customer-owned components and exclude them from JBC purchase subtotal. Never imply these parts cost nothing to own.
- Use one summary with selected count, existing compatibility result, estimated power, target budget where available, and JBC subtotal. Do not show a meaningful power estimate when required data is missing; use “Not available yet.”
- Preserve real compatibility checks. Distinguish “Not checked,” “Incomplete information,” detected issues, and verified results. Do not promise full compatibility just because eight slots are filled. Preserve any legitimate optional-component logic already in code.
- Put “Save build” and “Request a quote” near the summary. Explain precisely why an action is unavailable. Drafts may be saved only according to existing persistence rules.
- Keep Build details, saved-build selection, build name, target budget, build summary, New build, and Excel export. Group secondary actions into a compact toolbar/menu without deleting them.
- Confirm discarding unsaved changes when starting/loading another build. Preserve the latest saved state and show save errors accurately.
- Keep generic-model disclosure concise: “Generic model; labels reflect your selected parts.” Product selection does not require changing component geometry.
- Quote request review must show selected/owned components and known costs. A submitted quote request is not a placed or paid order.
- Mobile: viewer first, expandable component list next, compact sticky summary/action area with sufficient bottom padding. Avoid page-scroll versus orbit gesture conflicts. Preserve a usable component list if WebGL cannot load, with a retry/fallback message.

## 9. Component picker

- Use one consistent modal or drawer, titled for the selected category.
- Clearly select between “JBC inventory” and “I already own this component.” Display the selected source and its fields immediately.
- JBC inventory: search, relevant filters derived from actual fields, product name/specifications, actual price, and availability. Distinguish loading, no inventory, no search results, and data errors.
- For no stock, provide a clear explanation and the existing owned-component alternative. Do not fabricate available products or add an unsupported procurement workflow.
- Owned component: use the existing required identifying/specification fields; make uncertainty explicit where compatibility data is incomplete.
- Enable “Use component” only for a valid selection. Provide Cancel and Clear selection with unambiguous behavior. Do not clear an existing part merely because the user opens/closes its picker.
- Avoid nesting another full modal on top of this picker for routine selection details.

## 10. Shop, product details, cart, and checkout

- Lead with a useful search field and explicitly labelled filters. Inspect what the three existing “All” dropdowns actually represent before labelling them; do not guess field meanings.
- Add result count, sensible sorting, clear filters, and useful no-results states. Maintain filter/search state when opening and closing product details.
- Product cards: consistent image area with actual product image or honest fallback, brand/model, key available specifications, price, stock status, and clear Add to cart/View details actions.
- One available product should look intentional. Do not add mock products or stretch a card across the page to conceal sparse inventory.
- Product detail should use existing descriptions/specifications and preserve stock-aware purchasing. Display warranty information only when backed by product data.
- Cart: use a responsive drawer or page with product rows, quantity controls, remove action, subtotal, and one next-step action. Empty cart needs a concise “Browse parts” action.
- If bookings are separate from shopping, remove misleading “add services” cart copy. If service checkout is genuinely supported, preserve and explain it.
- Preserve existing pickup/delivery and payment workflows. Show known delivery charges separately from fees requiring confirmation. Do not invent payment methods, free delivery, or instant confirmation.
- Verify stock and pricing at the existing authoritative checkout boundary. Handle changed stock/prices and failures clearly; prevent duplicate orders.
- Do not represent cart addition, quote submission, payment processing, or order submission as completed payment.

## 11. My records and detail views

- Retain Purchases & warranties, Appointments, and PC requests, with clear active-tab styling. Counts may be added when derived from real records.
- Use compact rows or responsive cards instead of large nested containers. Include service/product/build name, reference where available, relevant date, readable status, and a labelled “View details” action.
- Add useful search/status filtering when supported by the dataset. Preserve selected tab/filter when returning from details.
- Provide structured details: summary, existing status progression/history, device or items, costs/quote/payment information, schedule/fulfilment, and supported next actions.
- Use existing timestamps and events only. Never fabricate progress milestones or estimated completion promises.
- Make requested, confirmed, cancelled, completed, paid, and other real domain states visually distinct with text plus color. Do not force unrelated record types into one invented status lifecycle.
- Display warranty terms/expiry and receipts only where real data supports them.
- Empty states should guide the customer toward booking, shopping, or building a PC, and remain compact.

## 12. Profile and settings

- Simplify the profile overview and separate Profile & contact from Display & account access using one coherent page/drawer or a single dialog with internal sections. Avoid stacked dialog chains.
- Keep photo, display name, sign-in email, contact email, phone, and address as supported.
- Present sign-in email clearly as read-only if the current app does not support changing it. Explain contact-email editing in plain language.
- Improve upload control with avatar preview, labelled upload/replace action, actual type/size limits, and useful validation feedback. Preserve the existing 500 KB limit unless the storage configuration explicitly changes.
- Group display density and reduced motion preferences with clear descriptions and real persisted behavior. Preserve password reset through the current provider.
- Add clear dirty/saving/saved/error states. Warn before losing unsaved edits, without interrupting every normal navigation action.

## 13. Responsive behavior, accessibility, and interaction states

- Verify at 360/390px mobile, 768px tablet, 1366×768 laptop, and 1920×1080 desktop. No horizontal page overflow, inaccessible footer actions, or text hidden under sticky regions.
- Use semantic navigation, headings, labels, buttons, and dialogs. Maintain keyboard navigation, visible focus, dialog focus trapping/restoration, and appropriate Escape behavior.
- Use comfortable pointer targets around 44px where feasible, readable supporting text, and measured text contrast. Do not rely on color alone for statuses.
- Support zoomed text and reduced motion. The reduce-motion setting should affect nonessential UI/automatic motion while keeping deliberate 3D interaction usable.
- Add consistent loading skeletons, submitting buttons, field errors, empty states, recoverable data failures, and concise success feedback. Do not use toasts as the only location for important errors.
- Long dialogs should have one scrolling body and visible actions, with enough padding that the footer never hides the last field or cost line.

## 14. Implementation and verification

- Reuse or refactor shared shell, buttons, fields, badges, tabs, dialogs, drawers, empty states, and summary components. Centralize visual tokens. Avoid duplicating business logic or creating a second disconnected customer application.
- Keep UI state and existing business/data services properly separated. Avoid unrelated framework migrations, backend rewrites, or arbitrary dependency additions.
- Audit shared styles for effects on admin pages. Preserve access checks and customer ownership filtering; UI visibility alone is not authorization.
- Keep WebGL performance stable. Prevent duplicate scenes, unnecessary renderer remounts, leaked event listeners, and repeated requests caused by layout changes.
- Run available lint/build checks and focused tests for affected workflows. Manually verify sign in/recovery, booking back navigation and submission, model controls and component-label synchronization, save/load builds, owned-parts totals, inventory empty states, cart/checkout, records details, and profile persistence.
- Test meaningful edge cases: failed fetch/submission, duplicate click, missing data, zero inventory, long names, narrow viewport, keyboard focus, and a selected part changing availability. Use test fixtures in development only.
- Compare before/after screenshots at the same viewport. Specifically verify that scrolling does not hide dashboard cards or builder controls beneath the page heading.
- Report observed defects separately from issues reproduced and fixed. Do not claim untested backend behavior works based on screenshots.

## 15. Delivery and acceptance criteria

Implement in this order: shared design system/customer shell → authentication → dashboard → booking → PC Builder and picker → shop/cart → records → profile/settings → focused QA.

The result is complete when all scoped pages use a consistent design, booking has clear progress and accurate fee wording, shop filters are understandable, empty states are compact, and the existing 3D model works with every original interaction and product label connection.

Deliver a concise summary of changes, affected files/routes, actual checks performed, before/after screenshots where possible, and any genuine backend/content gaps. Keep unsupported features explicit. Do not claim the site has been deployed unless deployment was separately requested and actually completed.

Begin by inspecting the current implementation, explain the concrete approach briefly, and proceed with the redesign.
