# Configuration

Every environment variable the AI Hub frontend reads, collected from `.env.example` and from every `process.env.*`
usage in the code. **This file lists names and purposes only. Never put real values in docs, issues or commits.**

## Where values come from

| Context | File | Notes |
|---|---|---|
| Local development | `.env.local` (copy of `.env.example`) | Git-ignored. Restart `npm run dev` after changing `NEXT_PUBLIC_*` values. |
| Prod, SIT, dev builds | That environment's `.env.production`, kept on the VM outside git | `aihub-deploy` copies it into the build folder before `docker build`, replacing any copy in the repo. |
| Prod, SIT, dev at runtime | The container's env file on the VM (passed with `docker run --env-file`) | Supplies server-only variables to the running container. |

Two rules decide where a variable has to be set:

- **`NEXT_PUBLIC_*` variables are compiled into the browser JavaScript by `next build`.** Changing one means
  rebuilding (`aihub-deploy frontend <env>`); restarting the container isn't enough. They are visible to anyone who
  opens the site, so they must never hold secrets.
- **Other variables are server-only** and are read when the Next.js server runs (route handlers in `app/api/`).
  `NODE_ENV` is set to `production` by the Dockerfile.

## Variables

"Needed in" says which environments need a value for the feature to work. **All** = local, dev, SIT and prod.

### Microsoft Entra ID (sign-in)

| Name | Kind | Read in | What it does | Needed in |
|---|---|---|---|---|
| `NEXT_PUBLIC_MICROSOFT_ENTRA_CLIENT_ID` | Build-time, public | `app/lib/msal.ts`, `app/lib/auth-server.ts` | Application (client) ID of the Entra app registration. The browser uses it for sign-in; the server uses it as the expected **audience** when verifying ID tokens. | All |
| `NEXT_PUBLIC_MICROSOFT_ENTRA_TENANT_ID` | Build-time, public | `app/lib/msal.ts`, `app/lib/auth-server.ts` | Directory (tenant) ID. Builds the authority URL (`/common` if empty) and the issuer and JWKS URL used to verify tokens on the server. If it's empty, server-side token checks fail. | All |
| `NEXT_PUBLIC_MICROSOFT_ENTRA_AD_REDIRECT_URI` | Build-time, public | `app/lib/msal.ts` | Redirect URI used **only while rendering on the server**. In the browser the redirect URI is always `window.location.origin + "/"`. Defaults to `http://localhost:3000/`. | Optional |

Each site origin (`https://ai-hub.protestcorp.com/`, `https://ai-hub-sit.protestcorp.com/`,
`https://ai-hub-dev.protestcorp.com/`, `http://localhost:3000/`, and any other host that serves this build) must be
registered as a **Single-page application** redirect URI on the app registration.

### Backend base URLs

On `ai-hub.protestcorp.com`, `ai-hub-sit.protestcorp.com` and `ai-hub-dev.protestcorp.com` the browser ignores these
and uses the page's own origin (`siteOrigin()` in `app/config/urls.ts`). They matter for localhost, for any other
hostname, and during server rendering.

| Name | Kind | Read in | What it does | Needed in |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Build-time, public | `app/config/urls.ts` (`BASE_URL`) | Base URL of the AI Hub backend (and, on the same host, the Playwright `/sessions` API). Must **end with `/`**, because paths are appended directly (`BASE_URL + "upload"`). | Local; set it on every env for safety |
| `NEXT_PUBLIC_API_BASE_URL_VERSION` | Build-time, public | `app/config/urls.ts` (`BASE_URL_VERSION`) | Version prefix for the Cypress framework endpoints, e.g. `api/v1` (no leading or trailing slash). **Used on every site**, because it is not replaced by the origin. | All |
| `NEXT_PUBLIC_CLARIFY_API_BASE_URL` | Build-time, public | `app/config/urls.ts` (`CLARIFY_API_BASE`) | Base URL of the requirement clarification agent (no trailing slash). Defaults to `http://localhost:4000`. | Local |
| `NEXT_PUBLIC_APPATLAS_API` | Build-time, public; also read by the server | `app/services/appatlas.ts`, `app/api/app-atlas/canvases/[id]/jira/route.ts` | App Atlas API base (no trailing slash), e.g. `<host>/atlas-api`. Defaults to the prod App Atlas URL. The browser uses it off the AI Hub hosts; `atlasUrl()` also uses it to recognise absolute asset URLs. The server's Jira proxy uses it if `APPATLAS_API_INTERNAL` isn't set. | Local; dev and SIT (as the server-side fallback) |
| `APPATLAS_API_INTERNAL` | Server-only | `app/api/app-atlas/canvases/[id]/jira/route.ts` | Optional in-network App Atlas URL for the server-side Jira proxy, so the container can reach App Atlas without going out through the public hostname. Falls back to `NEXT_PUBLIC_APPATLAS_API`, then the prod URL. | Optional (dev, SIT; prod once it has App Atlas) |

### Database

| Name | Kind | Read in | What it does | Needed in |
|---|---|---|---|---|
| `DATABASE_URL` | Server-only, **secret** | `app/lib/db.ts` | Postgres connection string for the `projects` and `user_integrations` tables, used by `/api/projects` and `/api/integrations`. The server doesn't support SSL, so don't add SSL options. Per the VM guide, prod uses the `aihub` database and SIT/dev use `aihub_nonprod`. | All (Projects and Integrations don't work without it) |

### Jira OAuth 2.0 (3LO), optional

Only used by `/api/auth/jira/authorize` and `/callback`, and to refresh OAuth tokens in `lib/jira-credentials.ts`.
The UI connects Jira with an **API token** instead, which needs none of these. If they're missing,
`/api/auth/jira/authorize` redirects back with `?error=jira_not_configured`.

| Name | Kind | Read in | What it does | Needed in |
|---|---|---|---|---|
| `JIRA_CLIENT_ID` | Server-only | `lib/jira.ts` | Atlassian OAuth app client ID | Only if Jira OAuth is used |
| `JIRA_CLIENT_SECRET` | Server-only, **secret** | `lib/jira.ts` | Atlassian OAuth app client secret | Only if Jira OAuth is used |
| `JIRA_REDIRECT_URI` | Server-only | `lib/jira.ts` | Callback URL; must exactly match the one registered on the Atlassian app, e.g. `<site>/api/auth/jira/callback` | Only if Jira OAuth is used |
| `JIRA_SCOPES` | Server-only | `lib/jira.ts` | Space-separated scopes. Default: `read:jira-work write:jira-work read:jira-user offline_access` | Optional |

### GitHub OAuth app, optional

Only used by `/api/auth/github/authorize`, `/callback` and token revocation on disconnect. The UI connects GitHub with
a **personal access token** instead.

| Name | Kind | Read in | What it does | Needed in |
|---|---|---|---|---|
| `GITHUB_CLIENT_ID` | Server-only | `lib/github.ts` | GitHub OAuth app client ID | Only if GitHub OAuth is used |
| `GITHUB_CLIENT_SECRET` | Server-only, **secret** | `lib/github.ts` | GitHub OAuth app client secret (also used to revoke grants on disconnect) | Only if GitHub OAuth is used |
| `GITHUB_REDIRECT_URI` | Server-only | `lib/github.ts` | Callback URL; must match the OAuth app, e.g. `<site>/api/auth/github/callback` | Only if GitHub OAuth is used |
| `GITHUB_SCOPES` | Server-only | `lib/github.ts` | Space-separated scopes. Default: `repo read:user user:email` | Optional |

### Swagger / OpenAPI

No variables. The user enters a spec URL (and optionally a bearer token) on `/integrations`.

### Set by the platform

| Name | Read in | What it does |
|---|---|---|
| `NODE_ENV` | `lib/oauth.ts`, `app/lib/db.ts` | `production` in the container (set in the `Dockerfile`; `next build` and `next start` also set it). Makes credential cookies `Secure`, and outside production reuses one Postgres pool across hot reloads. |

## Example `.env.local`

Placeholders only:

```bash
NEXT_PUBLIC_MICROSOFT_ENTRA_CLIENT_ID=<your-value>
NEXT_PUBLIC_MICROSOFT_ENTRA_TENANT_ID=<your-value>
NEXT_PUBLIC_MICROSOFT_ENTRA_AD_REDIRECT_URI=http://localhost:3000/

NEXT_PUBLIC_API_BASE_URL=<ai-hub-backend-base-url-ending-with-slash>
NEXT_PUBLIC_API_BASE_URL_VERSION=api/v1
NEXT_PUBLIC_CLARIFY_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_APPATLAS_API=https://ai-hub.protestcorp.com/atlas-api
DATABASE_URL=<your-value>

# Optional: only for the OAuth flows
JIRA_CLIENT_ID=<your-value>
JIRA_CLIENT_SECRET=<your-value>
JIRA_REDIRECT_URI=http://localhost:3000/api/auth/jira/callback
GITHUB_CLIENT_ID=<your-value>
GITHUB_CLIENT_SECRET=<your-value>
GITHUB_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
```

## Not configurable by environment

These are constants in code. Change them in the source if needed:

| Constant | File | Value or purpose |
|---|---|---|
| AI Hub hostname pattern | `app/config/urls.ts` (`siteOrigin`) | `^ai-hub(-sit\|-dev)?\.protestcorp\.com$`. A new site hostname (e.g. a demo host) uses the `NEXT_PUBLIC_*` values unless it is added here. |
| `ACTION_DRIVEN_TEST_CASE_GENERATOR_SITE` | `app/config/urls.ts` | `<origin>/vnc_lite.html` (noVNC page for action-driven recording) |
| `SELF_HEALING_SPEC` | `app/config/urls.ts` | Cypress spec path run by Self Healing |
| MSAL scopes | `app/lib/msal.ts` | `["User.Read"]` |
| Cookie lifetimes | `lib/oauth.ts` | Credentials 90 days, OAuth state 10 minutes |
| Poll intervals | various | Presence 15 s, clarification questions 5 s, model status 10 s / 30 s |
