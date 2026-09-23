# Open JBC RIGWORKS in Antigravity / Codex

Extract this archive, then open the jbc-rigworks folder (the one containing package.json) in your editor. Open the Codex extension and sign in.

Suggested first request:
Read START-HERE.md and README.md. Check my Node and pnpm setup, install the locked dependencies, initialize the local D1 database, and run this app locally. Keep the existing hosted deployment unchanged.

## Local setup

The project specifies Node >=22.13.0 and pnpm 11.25.0. Use a Node version compatible with that pnpm release. Run these commands in the project folder:

```sh
pnpm install --frozen-lockfile
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_true_jack_power.sql
pnpm dev
```

Apply the SQL migration only once to a fresh local database. The dev command defaults to port 5173; open the local URL printed by the terminal. Subsequent starts only require pnpm dev. This export omits dependencies, generated builds, local databases, and runtime profiles. Without a managed runtime profile, the project's scripts select portable local development.

## Local and hosted versions

Local records are separate from the hosted business database. Local development uses mock authentication; the hosted owner's access policy is enforced by Sites. Do not expose the development server as a production service.

Editing this copy does not automatically update the live website. Use ChatGPT Sites to save and deploy a reviewed version. Preserve .openai/hosting.json to retain the original Site identity. This archive has no Git history; optionally initialize a new local Git repository to track your edits.

Project overview and feature limitations are in README.md. This handoff does not transfer the entire ChatGPT conversation into the extension. The local setup has not been tested on your computer.

Source revision: 3df7c83ed6a2b5ba6a5e5e6d30aec27632754800
