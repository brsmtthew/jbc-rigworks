# JBC RigWorks

Customer and workshop management app built with React, TypeScript, Vite, Firebase Auth/Firestore, and a procedural Three.js PC builder.

## Development

Use Node.js 24 LTS or newer: the installed QR-reader dependency requires Node 24. The current machine may still build under Node 22, but that is outside the dependency's supported range.

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and supply your Firebase web-app configuration. Do not commit local credentials or service-account keys.
3. Run `npm run dev`.

Authentication and business records use Firebase. The retired browser-local demo is not part of this application. Account roles come from protected user profiles; public registration creates customers only.

## Commands

| Command                           | Purpose                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                     | Development server                                                  |
| `npm run build`                   | TypeScript checks and production bundle                             |
| `npm run lint`                    | Source lint checks                                                  |
| `npm run format`                  | Format maintained source, tests, docs and configuration             |
| `npm run format:check`            | Check formatting without changing files                             |
| `npm test` / `npm run test:logic` | Local logic/transaction simulation; no browser or Firebase emulator |
| `npm run test:integration`        | Explicit Firebase emulator rules and integration suites             |
| `npm run test:ui`                 | Explicit isolated browser/layout checks; may generate screenshots   |

The local transaction simulation is not a substitute for deployed rules or production verification. Run browser/emulator suites only when appropriate to the task; they were not run for the repository cleanup or architecture refactor.

## Project layout

- `src/features/`: nine domains: auth, builder, customer, dashboard, finance, inventory, pos, services, and settings.
- `src/components/`: shared UI and application layout.
- `src/hooks/`: shared live subscriptions, workspace reads, list filters and async-action guards.
- `src/lib/`: Firebase access, authentication and shared business/formatting helpers; feature operations live beside their pages.
- `src/App.tsx` and `src/routes.tsx`: providers and role-aware lazy routing.
- `src/types.ts`: shared business contracts.
- `src/styles/`: shared styling; 3D-specific styles stay beside the runtime.
- `public/branding/`: JBC brand assets and guidance.
- `tests/logic/`: fast local business-logic and transaction simulations.
- `tests/database/`: explicitly invoked Firebase emulator tests.
- `tests/ui/`: isolated browser fixtures and layout checks.
- `docs/`: architecture, Firebase setup, V2 implementation and checklist.

Generated folders (`node_modules`, `dist`, and test output) are hidden in the VS Code Explorer. Dependencies remain installed; build output is recreated by `npm run build`. Related package/TypeScript configuration files are nested.

See [Architecture](docs/ARCHITECTURE.md), [Firebase setup](docs/FIREBASE-SETUP.md), [V2 implementation](docs/V2-IMPLEMENTATION.md), and the [104-section checklist](docs/V2-CHECKLIST.md).

Customer-facing redesign details and verification limits are documented in [Customer UI](docs/CUSTOMER-UI.md).
