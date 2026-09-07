# Edufurther Scholarship Finder frontend

Next.js frontend for the Edufurther Scholarship Finder. The app collects an anonymous search profile, requests taxonomies and scholarship matches from the Finder API, and lets a user review each result before opening the provider's official application page.

## Local development

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The local proxy uses `/api/v1` and forwards to `NEXT_PUBLIC_API_BASE_URL` (or the server-only `EDUFURTHER_API_BASE_URL` override). The current development backend is Railway; local API contract checks use the backend configured for the workspace.

## Implemented V1 surface

- Responsive Finder form with taxonomy-backed origin and destination country search.
- Multiple destination selection, including searchable “Somewhere else” countries.
- Cached taxonomies in the browser for one hour.
- Search results with status, fit, provider, destination, funding, degree, deadline, eligibility note and verification date.
- Responsive scholarship cards with keyboard-accessible detail dialogs.
- Detail dialog for active/uncertain scholarships and preparation guidance for likely-to-reopen opportunities.
- Official provider links remain the primary application action.
- Backend response validation so incompatible taxonomy or search payloads fail visibly instead of silently rendering bad data.

The current `/search` contract does not provide every field shown in the design references. The detail dialog therefore displays `Not specified` or a review instruction when duration, selection criteria, or other narrative fields are absent. Those values should come from a versioned backend response before being added to the UI.

## Explicit V1 boundaries and hand-offs

The following are intentionally not implemented in this frontend release:

- WhatsApp subscription or WhatsApp notifications.
- Scholarship-alert subscriptions and deadline reminders.
- Core/product hand-off or account creation. No search preferences are transferred to another product yet.
- A Substack signup embed and email-capture flow.
- An in-app claim that a newsletter subscription or guide delivery succeeded.

The product documentation says the intended newsletter path is a supported Substack embed plus a Substack welcome email containing the Scholarship Prep Guide link. When this is implemented, the Substack publication owner must configure the welcome email and a stable PDF URL, while the frontend must embed the supported form without reading the iframe email or calling undocumented subscription endpoints. The guide should also remain independently downloadable. Subscription success should only be reported from a supported provider signal, not from an iframe submission alone.

Future work should add these integrations behind versioned contracts: Substack embed/welcome-email QA, a separate alert/reminder preference flow, WhatsApp consent and delivery, and an explicit Core hand-off with retry/expiry handling. Until then, the UI must not imply that any of those actions have completed.

## Sentry configuration

Sentry is installed but deliberately disabled unless the runtime is production and the corresponding boolean is explicitly enabled. Preview/development deployments should leave these variables unset or false.

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_ENABLED` | Browser runtime | Enables client-side Sentry in production. |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser runtime | Public DSN used by the browser SDK; it is safe to expose as a client configuration value. |
| `SENTRY_ENABLED` | Server/edge runtime | Enables server and edge Sentry in production. |
| `SENTRY_DSN` | Server/edge runtime | DSN used by server and edge SDKs. It is kept separate because server code must not depend on a browser-prefixed variable. |
| `SENTRY_BUILD_ENABLED` | Production build | Enables the Sentry webpack plugin and source-map upload. This is a build switch, not an event-capture switch. |
| `SENTRY_AUTH_TOKEN` | Vercel Production build secret | Authenticates source-map upload. Never commit it or expose it to the browser. |

The two DSN variables look duplicated because the browser and server bundles have different environment boundaries. The boolean runtime flags are the on/off switches, but they are not the only guard: the code also requires `NODE_ENV=production` and a non-empty matching DSN. `SENTRY_BUILD_ENABLED` separately controls build-time source-map instrumentation/upload.

Configure the following only in the Vercel **Production** environment:

```env
NEXT_PUBLIC_SENTRY_ENABLED=true
NEXT_PUBLIC_SENTRY_DSN=<Sentry DSN>
SENTRY_ENABLED=true
SENTRY_DSN=<Sentry DSN>
SENTRY_BUILD_ENABLED=true
SENTRY_AUTH_TOKEN=<Sentry auth token>
```

## Quality checks

```powershell
npm run lint
npm run typecheck
npm run api:check
npm run build
$env:CI='1'; npm run test:e2e
```

The E2E suite covers desktop and mobile form/search flows, country keyboard navigation, multiple “Somewhere else” destinations, validation and API failure states. Production Sentry ingestion still requires a Production deployment with the variables above; local builds intentionally do not upload source maps or send telemetry.

## Related product reference

The broader product decisions and integration boundaries are in the local Scholarship Finder documentation pack at `C:\Users\adele\.codex\.chatgpt-projects\g-p-6764b5de85d08191ae98d53045ed5a51\docs\scholarship-finder\README.md`. It records the Substack welcome-email decision, anonymous V1 access, the non-goals for WhatsApp and hand-offs, and the requirement that official-provider access remain primary.
