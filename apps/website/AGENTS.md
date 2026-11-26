<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Website ownership

Read the repository-root `AGENTS.md` and `docs/website-api-contract.md` (paths from the repository root). This application is the public Next.js frontend. The owner subsequently authorised Codex to build its CRM/public backend; that implementation lives in `services/crm-api` and is documented in `docs/website-backend.md`. Website frontend tasks still use the public contract and must not import private record/session APIs into public components. Keep the independent package/lockfile and existing CRM runtime intact. Backend changes require their own scoped authorization and service checks.

Never replace a failed public API request with sample data. Sample mode is explicit and local-host-only, with a visible notice. Unknown company hosts and foreign IDs fail closed. Public components receive projected public fields only. Do not restore mandatory Super Admin website publication approval: the owner selected direct Publish with scoped grants and validation.

Keep every handwritten code/configuration/test file at 150 physical lines or fewer after formatting. `.next`, package lockfiles and generated framework declarations are outputs, not handwritten source. Verify `npm test`, `npm run typecheck`, `npm run build` from this directory and the root file-size baseline. Review desktop/mobile and light/dark company pages through the focused website browser check. Never claim enquiry delivery, CRM publishing or domain activation from a sample preview.
