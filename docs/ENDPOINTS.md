# Endpoints

Every HTTP endpoint this frontend calls, found by reading the code, plus the pages and API routes the app serves itself.
Request and response shapes are described **as the frontend uses them**. The owning service may return more fields;
check that service's own docs for the full contract.

**Contents:** [How base URLs are resolved](#how-base-urls-are-resolved) ·
[AI Hub backend](#1-ai-hub-backend-backend_ai_agents) ·
[Playwright codegen service](#2-playwright-codegen-service-playwright-action-based) ·
[Requirement clarification agent](#3-requirement-clarification-agent) ·
[App Atlas backend](#4-app-atlas-backend-appatlas-backend) ·
[This app's API routes](#5-this-apps-own-api-routes-appapi) ·
[Third-party APIs called server-side](#6-third-party-apis-called-from-the-nextjs-server) ·
[Pages](#7-pages-served-by-this-app)

---

## How base URLs are resolved

All of this is in `app/config/urls.ts` and `app/services/appatlas.ts`.

| Constant | In the browser on `ai-hub.protestcorp.com`, `ai-hub-sit...` or `ai-hub-dev...` | Anywhere else (localhost, other hosts, server rendering) |
|---|---|---|
| `BASE_URL` | `<page origin>/` | `NEXT_PUBLIC_API_BASE_URL` (must end with `/`) |
| `BASE_URL_VERSION` | `NEXT_PUBLIC_API_BASE_URL_VERSION` (e.g. `api/v1`, no leading slash) | same |
| `CLARIFY_API_BASE` | `<page origin>` | `NEXT_PUBLIC_CLARIFY_API_BASE_URL`, else `http://localhost:4000` |
| `APPATLAS_API` | `<page origin>/atlas-api` | `NEXT_PUBLIC_APPATLAS_API`, else `https://ai-hub.protestcorp.com/atlas-api` |
| `ACTION_DRIVEN_TEST_CASE_GENERATOR_SITE` | `<page origin>/vnc_lite.html` | `https://ai-hub.protestcorp.com/vnc_lite.html` |

On the real sites, each site's nginx forwards paths to that environment's containers (from the VM guide in
appatlas-backend `deploy/VM-GUIDE.md`):

| Path | Goes to |
|---|---|
| `/` and `/api/auth/*`, `/api/projects*`, `/api/integrations`, `/api/app-atlas/*` | This frontend (`frontend`, `frontend-sit`, `frontend-dev`) |
| `/api/v1/...`, `/upload`, `/upload-excel`, `/process-image`, `/manual-test`, `/cypress/...`, `/repo-structure`, `/file-content`, `/health`, `/stats...`, `/error-logs` | AI Hub backend (`aihub-backend`, `-sit`, `-dev`) |
| `/api/v1/clarify/...` | Requirement clarification agent (the VM guide lists this route for prod; confirm it exists on SIT/dev) |
| `/sessions/...`, `/vnc/`, `/websockify`, noVNC page | Playwright codegen service (`playwright-codegen-cloud`, `-sit`, `-dev`) |
| `/atlas-api/...` | App Atlas backend (one container for all sites) |

> `/sessions/...` (Playwright, called through `BASE_URL`) and `/atlas-api/sessions/...` (App Atlas) are different
> services. Don't confuse them.

**Auth header legend** used in the tables below:

- **None**: no `Authorization` header.
- **Entra ID token**: `Authorization: Bearer <Microsoft Entra ID token>` from `getFreshIdToken` (`app/lib/auth-client.ts`).
- **Cookies**: the browser sends this site's httpOnly cookies automatically (same origin).

---

## 1. AI Hub backend (`backend_ai_agents`)

Python service. Container ports 5000 (prod), 5200 (SIT), 5100 (dev). Called through the axios wrapper `xhr.ts` from
`app/services/generate.ts`, `app/services/analytics.ts` and `app/services/workplace.ts`, except `cypress/run-tests`,
which uses `fetch` to read a stream.

`xhr.ts` sets `Content-Type: multipart/form-data` when a call passes `files: true`
(axios turns the plain object into form data), otherwise `application/json`. On failure it throws `error.response`.

### Test case and test data generation, Debugger, Selenium scripts

| Method | Path | Used by | Request | Response used |
|---|---|---|---|---|
| POST | `upload` | `generateDraft`, `app/pages/projects/generate-draft/index.tsx` | multipart `file` (story PDF) | Either an array of test cases, or `{ test_cases: TestResultsItem[], test_data: TestDataItem[], ticket?, pdf?, excel? }` (`GenerateDraftResponse` in `app/interfaces/project.ts`) |
| POST | `upload-excel` | `downloadExcelDraft`, same page | `FormData` with `file` (same PDF); `responseType: blob` | `.xlsx` blob. Uses the `content-type` and `content-disposition` headers for the download name (fallback `<pdf name>_test_suite.xlsx`). |
| POST | `process-image` | `processImage`, `app/pages/projects/debugger/index.tsx` | multipart `file` (screenshot) | `{ markdown }` |
| POST | `manual-test` | `generateScript`, `app/pages/projects/automated-test-script-generation/index.tsx` | multipart `{ file, url, test_engine }`; `test_engine` is the lower-cased segment, e.g. `selenium` | `{ code }` |

### Cypress framework generation (`/projects/automated-test-script-generation/cypress`)

All used by `app/pages/projects/automated-test-script-generation/cypress/index.tsx`. `<v>` is `BASE_URL_VERSION`
(e.g. `api/v1`).

| Method | Path | Function | Request | Response used |
|---|---|---|---|---|
| POST | `<v>/input` | `uploadGenerateScriptFile` | multipart `{ excel_file, base_url }` | `{ session_id }` |
| POST | `<v>/generate` | `generateCypress` | JSON `{ session_id }` | `{ generated_files: [...] }` (must be a non-empty array) |
| GET | `<v>/framework/tree` | `getFilesTree` | none | File tree object |
| GET | `<v>/files/content?path=<path>` | `getFileContent` | `path` query (not URL-encoded by the client) | File contents (text) |
| GET | `<v>/files/download?path=<path>` | `getDownloadUrl` | `path` query | `{ download_url }`, then opened with `window.open` |

### Self Healing (`/projects/self-healing`)

Used by `app/pages/projects/self-healing/index.tsx`. The spec it runs is the constant `SELF_HEALING_SPEC` in
`app/config/urls.ts`.

| Method | Path | Function | Request | Response used |
|---|---|---|---|---|
| GET | `repo-structure` | `getSelfHealingRepoStructure` | none | File tree |
| GET | `file-content?path=<path>` | `getSelfHealingFileContent` | `path` query | File contents (text) |
| POST | `cypress/run-tests?workplace=<w>&accelerator=Self+Healing+Cypress` | `runSelfHealingScripts` (`fetch`) | JSON `{ break_test: boolean, spec, url }`; header `Accept: text/event-stream` | Server-sent event lines `data: {...}`. Each JSON has `line`; the last has `done: true` and, on failure, `failed: true, file_path, line, failed_selector`. `[DONE]` is ignored. |
| POST | `cypress/heal?workplace=<w>&accelerator=Self+Healing+Cypress` | `runSelfHealingHeal` | JSON `{ failed_selector, file_path }` | `{ healedSelector, confidence, strategy, filePath }` |
| POST | `cypress/reset` | `runSelfHealingReset` | none | Ignored (success only) |
| GET | `cypress/download?path=<path>` | Opened with `window.open` (not a fetch) | `path` query | File download |

### Dashboards, metrics, error log

| Method | Path | Used by | Request | Response used |
|---|---|---|---|---|
| GET | `health` | `getServerStatus` (passes `skipAuth`), Home `app/pages/page.tsx` | none | `{ details: { Backend: boolean, database: boolean } }`; if either is false, Home shows the backend as down |
| GET | `stats?back=<seconds>` | `getBusinessMetrics`, Home and `app/pages/metrics/business-usage/page.tsx` | `back` = look-back window in seconds | `{ total_invocations: { data }, tokens: { input, output }, models }` |
| GET | `stats/performance?back=<seconds>` | `getPerformanceMetrics`, `app/pages/metrics/performance-reliability/page.tsx` | same | `{ api_latency, error_rate, inference_latency, throughput }` |
| GET | `stats/quality?back=<seconds>` | `getQualityMetrics`, `app/pages/metrics/model-quality-operational/page.tsx` | same | `{ hallucination, healing, validity_rate }` |
| GET | `error-logs?page=<n>&limit=<n>` | `fetchErrorLogs`, `app/pages/workplace/error-log/page.tsx` | paging | `{ data: [...], total, pages }` |

---

## 2. Playwright codegen service (`playwright-action-based`)

FastAPI on port 8000 plus noVNC on 6080 (prod; SIT 8200/6280, dev 8100/6180). Called through `BASE_URL` with `xhr.ts`
from `app/services/generate.ts`, so **Auth: None**. Routed by nginx (`/sessions/...`, noVNC paths).

| Method | Path | Function and page | Request | Response used |
|---|---|---|---|---|
| POST | `sessions` | `generateActionDrivenNewRunSessions`, `action-driven-test-case-generator-new-run/index.tsx` | JSON `{ url }` (the app to record) | `{ sessionId }` |
| GET (page) | `vnc_lite.html` | `ACTION_DRIVEN_TEST_CASE_GENERATOR_SITE`, opened in a new tab by `openExternalTabAndWait` (`.../new-run/actions.ts`) and by the rerun table | none | noVNC page showing the remote browser. The app polls until the tab is closed. |
| POST | `sessions/<id>/stop` | `generateActionDrivenStopSession`, called when the noVNC tab closes | none | Ignored; the save modal then opens |
| POST | `sessions/<id>/save` | `generateActionDrivenSaveSession`, `.../new-run/executions.tsx` | JSON `{ name, description }` (`ActionDrivenTestCaseSession`) | Ignored (success only) |
| GET | `sessions/<id>/manualtest` | `generateActionDrivenManualTestCases`, `.../new-run/executions.tsx` | none | Array of manual test cases |
| GET | `sessions/executions?page=<n>&limit=<n>` | `getExecutions`, `action-driven-test-case-generator-rerun/index.tsx` | paging | `{ items: ExecutionItem[], total, pages }`; `ExecutionItem = { id, name, description, username, created_at }` |
| POST | `sessions/executions/<id>/run` | `generateActionDrivenRerunSession`, `.../rerun/table.tsx` (also opens the noVNC tab) | none | `{ screenshot_url, video_url, ... }`, shown in a modal with download buttons (`window.open`) |

---

## 3. Requirement clarification agent

Node service on port 4000 (prod container `clarify-agent`; SIT and dev share `clarify-agent-nonprod`, port 4100 on
the VM). Base URL `CLARIFY_API_BASE`. Called with plain `fetch`. **Auth: None.**

| Method | Path | Used by | Request | Response used |
|---|---|---|---|---|
| POST | `/api/v1/clarify/analyze` | `app/pages/projects/clarification-agent/index.tsx` | `FormData { file, inputType: "document" \| "screenshot" }` | `{ questionCount, confidenceScore, processingTimeMs, qwenOutput, finalOutput }`. On error the message is read from `message`, `error` or `details`. |
| GET | `/api/v1/clarify/model-status` | `getModelStatus` → `useModelStatus` (`app/hooks/use-model-status.ts`), Home | none (`cache: no-store`) | `{ state }`, the Hugging Face endpoint state. Polled every 10 s while starting, otherwise every 30 s. Doesn't wake the model. |
| GET | `/api/v1/clarify/model-usage?period=current\|last` | `getModelUsage`, Home | `period` | `{ state, instanceType, pricePerHourUsd, computeMinutes, costUsd }` (`ModelUsage`). Non-2xx throws. |

The App Atlas backend also calls this agent server-to-server for per-ticket clarification questions; the frontend
only reads the results from App Atlas.

---

## 4. App Atlas backend (`appatlas-backend`)

Base URL `APPATLAS_API` (`<origin>/atlas-api` on the AI Hub sites). The client is `atlasClient()` in
`app/services/appatlas.ts`, used by the components in `app/components/app-atlas/`. Types are in
`app/interfaces/appatlas.ts`, copied from the backend's `backend/src/types.ts`. The full contract is in the backend
repo's `API.md` and `FRONTEND.md`.

**Auth: Entra ID token** on every call. Client behaviour:

- `Content-Type: application/json` only when there is a body.
- On **401** it retries **once** with a force-refreshed token.
- **204** resolves to `undefined`.
- Other non-2xx responses throw `AtlasError(body.error ?? statusText, status)`.

| Method | Path | Client method | Used by | Request | Response |
|---|---|---|---|---|---|
| POST | `/sessions` | `startSession` | `atlas-workspace.tsx` (Run AppAtlas, +, viewer switch) | `{ url, devicePreset: "desktop", networkPreset: "none", viewer: "auto" \| "vnc" }` | `SessionSnapshot` |
| GET | `/sessions/:id` | `getSession` | `atlas-workspace.tsx`, to re-attach after a reload | none | `SessionSnapshot` |
| GET (SSE) | `/sessions/:id/events?access_token=<id token>` | `openEvents` | `recording-view.tsx` | `EventSource` can't send headers, so the token is in the query string | `snapshot` events whose data is a `SessionSnapshot`. Older `revision`s are ignored; the stream closes at `finished`, `expired` or `error`. |
| POST | `/sessions/:id/finish` | `finishSession` | `recording-view.tsx` ("Finish & Save") | none | Final `SessionSnapshot` |
| DELETE | `/sessions/:id` | `discardSession` | `recording-view.tsx` (Discard), `atlas-workspace.tsx` (viewer switch) | none | 204 |
| GET | `/canvases` | `listCanvases` | `atlas-workspace.tsx` | none | `CanvasSummary[]` (filtered in the UI by the project's host and "My History") |
| GET | `/canvases/:id` | `getCanvas` | `atlas-workspace.tsx` | none | `Canvas` (nodes, edges, test data, `jira` mapping, `clarifications`). 404 means it was deleted. |
| POST | `/canvases` | `saveCanvas` | `save-execution-modal.tsx` through `atlas-workspace.tsx` | `{ sessionId, name, description? }` | `Canvas` |
| PATCH | `/canvases/:id` | `renameCanvas` | Explorer rename | `{ name?, description? }` | `Canvas` |
| DELETE | `/canvases/:id` | `deleteCanvas` | Explorer delete | none | 204 |
| GET | `/canvases/:id/clarifications` | `getClarifications` | `atlas-workspace.tsx`, polled every 5 s while any item is `queued` or `running` | none | `{ canvasId, pending, items: CanvasClarification[] }` |
| POST | `/canvases/:id/clarifications/retry` | `retryClarifications` | **Not called anywhere** (the buttons moved to the logs dashboard) | `{ issueKey?, force? }` | `CanvasClarifications` |
| POST | `/presence` | `presence` | `atlas-workspace.tsx`, every 15 s and on leave | `{ room: "app-atlas:<projectId>", leaving }` | `{ users: PresenceUser[] }`, shown as avatars |
| POST | `/presence` | direct `fetch` | `app/lib/site-presence.tsx` (every signed-in page, every 15 s while the tab is visible) | `{ room: "ai-hub", page: <pathname> }` | Ignored. Uses a silent token only, so it never triggers a sign-in. |
| GET (asset) | viewer URL, `shotUrl`, `screenshotUrl` | `atlasUrl()` | `recording-view.tsx` (iframe), `screen-node.tsx`, recording sidebar `<img>` | URLs may be relative to the API or absolute on the prod host; `atlasUrl` rewrites them onto the current site's `APPATLAS_API` | neko (WebRTC) or noVNC page; JPEG screenshots |

**Proxied through this app (not called from the browser directly):** `POST` and `DELETE /canvases/:id/jira`. The
browser calls `/api/app-atlas/canvases/:id/jira` (section 5), which adds the user's Jira credentials from cookies and
forwards to App Atlas at `APPATLAS_API_INTERNAL` or `NEXT_PUBLIC_APPATLAS_API`.

---

## 5. This app's own API routes (`app/api`)

Next.js route handlers. Called with same-origin `fetch`. "Entra" means the handler calls `verifyRequestUser`
(`app/lib/auth-server.ts`): it checks `Authorization: Bearer <id token>` with `jose` against the tenant's JWKS
(issuer `https://login.microsoftonline.com/<tenant>/v2.0`, audience = client ID, 300 s clock tolerance) and returns
401 if it isn't valid.

Credential cookies (`lib/oauth.ts`) are httpOnly, `SameSite=Lax`, `Secure` in production, path `/`, and last 90 days
(OAuth state cookies 10 minutes).

### Projects (Postgres `projects` table)

Used by `ProjectsProvider` in `app/lib/projectsStore.tsx`, which every signed-in page gets from `app/pages/layout.tsx`.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/projects` | **None** (the client doesn't send a token and the handler doesn't check) | none | `Project[]`, newest first: `{ id, name, description, domain, department, workspace, owner, dateOfCreation, applicationUrl, authRequired, authType, product, status, dueDate, progress }` |
| POST | `/api/projects` | Entra | `{ name, description?, domain, department, workspace, applicationUrl?, authRequired?, authType?, product, status? }`. The owner is taken from the token. | 201 with the created project |
| PATCH | `/api/projects/:id` | Entra | Any of `name, description, workspace, department, applicationUrl, authRequired, authType, status` (other keys are ignored; `owner` is never accepted) | `{ ok: true }`; 400 if no valid fields |
| DELETE | `/api/projects/:id` | Entra | none | `{ ok: true }`; 404 if not found |

### Integrations (Postgres `user_integrations`, created automatically if missing)

Used by `useIntegrationStatus` (`app/hooks/use-integration-status.ts`) on `/integrations` and in App Atlas's
"Connect apps" modal.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/integrations` | Entra | none | `{ user: { name, email, oid }, integrations: [{ provider, meta, connectedAt }] }` |
| POST | `/api/integrations` | Entra | `{ providers: [{ provider: "jira"\|"github"\|"swagger", meta? }] }` or `{ provider, meta }` | Same as GET. 400 if no valid provider. |
| DELETE | `/api/integrations?provider=<p>` | Entra | none | `{ disconnected: true, provider }` |

The hook retries POST and DELETE once with a refreshed token on 401. A provider counts as connected if **either**
the cookie-based status route **or** the database row says so.

### Jira, GitHub, Swagger connections (`app/api/auth/*`)

| Method | Path | Auth | Request | Response and side effects |
|---|---|---|---|---|
| POST | `/api/auth/jira/connect` | None | `{ siteUrl, email, apiToken }`; the site must be `https` | Verifies with Jira `/rest/api/3/myself` and `/serverInfo`. Sets cookies `jira_api_token`, `jira_email`, `jira_site_url`, `jira_site_name`. Returns `{ connected, siteName, siteUrl }`; 401 if the credentials are rejected, 400 otherwise. |
| GET | `/api/auth/jira/status` | Cookies | none | `{ connected, siteName, siteUrl }` |
| POST | `/api/auth/jira/disconnect` | None | none | Clears every Jira cookie. `{ disconnected: true }` |
| GET | `/api/auth/jira/authorize?returnTo=<path>` | None | Browser navigation | OAuth 2.0 (3LO): 302 to `auth.atlassian.com/authorize`, sets `jira_oauth_state` and `oauth_return_to`. Redirects back with `?error=jira_not_configured` when the `JIRA_*` variables are missing. **No UI links here today.** |
| GET | `/api/auth/jira/callback` | None | `code`, `state` from Atlassian | Exchanges the code, picks the first accessible site, sets `jira_refresh_token`, `jira_cloud_id`, `jira_site_name`, `jira_site_url`, then redirects to `returnTo` (default `/integrations`) with `?connected=jira` or `?error=access_denied\|invalid_state\|token_exchange_failed` |
| POST | `/api/auth/github/connect` | None | `{ token }` (personal access token) | Verifies with `GET api.github.com/user`. Sets `github_access_token`, `github_username`. Returns `{ connected, username }`; 401 if invalid. |
| GET | `/api/auth/github/status` | Cookies | none | `{ connected, username }` |
| POST | `/api/auth/github/disconnect` | Cookies | none | Revokes the OAuth grant on GitHub (best effort), clears GitHub cookies. `{ disconnected: true }` |
| GET | `/api/auth/github/authorize?returnTo=<path>` | None | Browser navigation | OAuth: 302 to `github.com/login/oauth/authorize`. `?error=github_not_configured` when unset. **No UI links here today.** |
| GET | `/api/auth/github/callback` | None | `code`, `state` | Exchanges the code, sets `github_access_token`, `github_username`, redirects with `?connected=github` or an error |
| POST | `/api/auth/swagger/connect` | None | `{ specUrl, token? }` | Fetches the spec (also tries `<path>-json` and `/v3/api-docs` for Swagger UI URLs; 15 s timeout). Rejects localhost, private IP ranges, `.local` and `.internal` hosts. Sets `swagger_spec_url`, `swagger_title`, and `swagger_access_token` if a token was given. Returns `{ connected, title, version, openapi, specUrl }`. |
| GET | `/api/auth/swagger/status` | Cookies | none | `{ connected, title, specUrl }` |
| POST | `/api/auth/swagger/disconnect` | None | none | Clears the Swagger cookies. `{ disconnected: true }` |

The connect calls come from `app/components/connect-integration-modal.tsx`; status and disconnect come from
`useIntegrationStatus`.

### App Atlas Jira routes (`app/api/app-atlas`)

These exist so the user's Jira credentials (httpOnly cookies) never reach browser code. Both read the Jira connection
with `resolveJiraCredentials` (`lib/jira-credentials.ts`): API token (site + email + token) if present, otherwise OAuth
(refresh token + cloud ID, refreshed on every call). A rotated refresh token is written back to the cookie.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/app-atlas/jira/projects` | Entra + Jira cookies | none | `{ projects: [{ key, name }] }`, paged from Jira `/rest/api/3/project/search` (50 per page, up to 1000). 409 if Jira isn't connected, 401 if Jira rejects the credentials or the session expired, 502 for other Jira errors. Used by `listJiraProjects` in the Connect apps modal. |
| POST | `/api/app-atlas/canvases/:id/jira` | Entra token forwarded + Jira cookies | `{ projectKey, regenerate? }` | Forwards `POST <atlas>/canvases/:id/jira` with `{ projectKey, regenerate, jira: <credentials> }` and the caller's `Authorization` and `Origin` headers (App Atlas uses the Origin to pick the environment's clarification agent). Returns App Atlas's status and body (the updated `Canvas`). 400 without `projectKey`, 409 or 401 for Jira problems, 502 if App Atlas is unreachable. Used by `connectJira`. |
| DELETE | `/api/app-atlas/canvases/:id/jira` | Entra token forwarded | none | Forwards `DELETE <atlas>/canvases/:id/jira`. Returns the updated `Canvas`. Used by `disconnectJira`. |

---

## 6. Third-party APIs called from the Next.js server

These are called only by route handlers, never by the browser.

| Service | Calls | File |
|---|---|---|
| Microsoft Entra ID | `GET https://login.microsoftonline.com/<tenant>/discovery/v2.0/keys` (JWKS for token checks) | `app/lib/auth-server.ts` |
| Atlassian OAuth | `POST https://auth.atlassian.com/oauth/token` (code exchange and refresh), `GET https://api.atlassian.com/oauth/token/accessible-resources` | `lib/jira.ts` |
| Jira REST v3 | `GET <site>/rest/api/3/myself`, `GET <site>/rest/api/3/serverInfo` (Basic auth with email + API token); `GET .../project/search` on `<site>/rest/api/3` (API token) or `https://api.atlassian.com/ex/jira/<cloudId>/rest/api/3` (OAuth Bearer) | `lib/jira.ts`, `lib/jira-credentials.ts`, `app/api/app-atlas/jira/projects/route.ts` |
| GitHub | `POST https://github.com/login/oauth/access_token`, `GET https://api.github.com/user`, `DELETE https://api.github.com/applications/<client id>/grant` | `lib/github.ts` |
| Any OpenAPI host | `GET <specUrl>` and the derived candidate URLs | `lib/swagger.ts` |
| App Atlas | `POST` and `DELETE <APPATLAS_API_INTERNAL or NEXT_PUBLIC_APPATLAS_API>/canvases/:id/jira` | `app/api/app-atlas/canvases/[id]/jira/route.ts` |
| Postgres | `projects` (read/write), `user_integrations` (created if missing) | `app/lib/db.ts`, `app/api/projects/*`, `app/lib/integrations-db.ts` |

---

## 7. Pages served by this app

Public URL → file. Pretty URLs are mapped onto `app/pages/*` by rewrites in `next.config.js`, and `/pages/*` redirects
to the pretty URL. "Guarded" means the page is wrapped in `AuthGuard` and sends signed-out users to `/`.

| URL | File | Guarded | Notes |
|---|---|---|---|
| `/` | `app/page.tsx` → `app/auth/page.tsx` | No (redirects to `/home` if signed in) | Microsoft sign-in |
| `/auth/signup` | `app/auth/signup/page.tsx` | No | Placeholder; `/auth` itself redirects to `/` |
| `/home` | `app/pages/page.tsx` | Yes | Dashboard |
| `/projects` | `app/pages/projects/page.tsx` | Yes | Project list and create/edit |
| `/projects/<id>?workplace=&domain=` | `app/pages/projects/[...slug]/page.tsx` | Yes | Life-cycle wheel; links to the accelerators below with `?projectId=` |
| `/projects/clarification-agent` | `app/pages/projects/clarification-agent/` | Yes | |
| `/projects/generate-draft` | `app/pages/projects/generate-draft/` | Yes | |
| `/projects/automated-test-script-generation` | `app/pages/projects/automated-test-script-generation/` | Yes | Wheel label "Automated test case generator - cypress", but the segment sent is `Selenium` |
| `/projects/automated-test-script-generation/cypress` | `.../automated-test-script-generation/cypress/` | Yes | Wheel label "... - Selenium", segment `Cypress` |
| `/projects/debugger` | `app/pages/projects/debugger/` | Yes | |
| `/projects/action-driven-test-case-generator-new-run` | `app/pages/projects/action-driven-test-case-generator-new-run/` | Yes | |
| `/projects/action-driven-test-case-generator-rerun` | `app/pages/projects/action-driven-test-case-generator-rerun/` | Yes | |
| `/projects/self-healing` | `app/pages/projects/self-healing/` | Yes | |
| `/app-atlas?projectId=<id>` | `app/pages/app-atlas/page.tsx` | Yes | Full-screen workspace; reached from the Home "App Atlas" tab (not in the side nav) |
| `/integrations` | `app/pages/integrations/page.tsx` | Yes | |
| `/metrics/business-usage`, `/metrics/performance-reliability`, `/metrics/model-quality-operational` | `app/pages/metrics/*/page.tsx` | Not wrapped in `AuthGuard` | Charts |
| `/workplace/error-log` | `app/pages/workplace/error-log/page.tsx` | Yes | |
| `/metrics`, `/domain`, `/resources`, `/settings`, `/customer-support`, `/updates`, `/billing-management`, `/billing-management/{current-plan,billing-history,financial-reports}`, `/workplace/{workplace-setup,user-management}` | `app/pages/...` | Yes (`ComingSoon` wraps `AuthGuard`) | "Coming soon" |

There is no `/workplace` index page, so `/workplace` on its own returns 404.
