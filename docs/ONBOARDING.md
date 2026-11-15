# Frontend onboarding (new FE developer)

Read this first if you are joining the AI Hub frontend. It explains what lives in **this** repo, what lives
elsewhere, how dig / sit / prod relate, and where to change App Atlas UI safely.

**Repo:** [aihub_frontend_projects](https://github.com/Pro-Test-Consulting-Private-Limited/aihub_frontend_projects)  
**Integration branch:** `dev` (deployed to dig and sit)  
**Ops / logs UI is not here** — that is plain JS inside [appatlas-backend](https://github.com/Pro-Test-Consulting-Private-Limited/appatlas-backend) (`backend/admin-ui/`). See that repo's `docs/architecture/06-operations-dashboard.md`.

---

## What this app is

| Piece | Role |
|---|---|
| AI Hub shell | Sign-in (Microsoft Entra), home, projects, accelerators, metrics, integrations |
| App Atlas workspace | `/app-atlas?projectId=` — canvas, recording, SIT / API / Coverage / CI/CD / Security / Performance / Reports tabs |
| Next.js `app/api/*` | Server-only: Postgres projects/integrations, Jira/GitHub cookies, proxy to App Atlas for Jira map |

Almost every screen is a **client component**. The browser talks to backends through nginx on each host. The Next
server only holds secrets (DB, integration cookies) and the Jira proxy.

---

## Environments (frontends are per env)

| Env | URL | Container | Typical branch |
|---|---|---|---|
| Dig (dev) | https://ai-hub-dev.protestcorp.com | `frontend-dev` | `dev` |
| SIT | https://ai-hub-sit.protestcorp.com | `frontend-sit` | promote from dig, or build `dev` |
| Prod | https://ai-hub.protestcorp.com | `frontend` | `main` / promote from sit |

```bash
aihub-deploy frontend dig              # or: frontend dev <commit>
aihub-deploy promote frontend dig sit
aihub-deploy promote frontend sit prod
aihub-deploy rollback frontend dig
```

Each env gets its **own Docker image** because `NEXT_PUBLIC_*` is baked in at build time from that env's
`.env.production` on the VM.

### Shared backends (important)

| Service | Containers | Notes |
|---|---|---|
| This frontend | 3 (prod / sit / dig) | Code + promote per env |
| App Atlas API | **1** `appatlas-backend` | All three sites call `/atlas-api/` → same backend |
| API test agent | **1** `api-agent` | Shared |
| Security agent | **1** `security-agent` | Shared |

So: changing FE dig does **not** change FE sit until you promote. Changing App Atlas **backend** once updates the
API for dig, sit, and prod.

Ops dashboard: https://logs.protestcorp.com/admin/ (shared nginx login; not part of this frontend).

---

## Where to edit (App Atlas)

| Concern | Start here |
|---|---|
| Workspace shell, tabs, header, profile | `app/components/app-atlas/atlas-workspace.tsx` |
| Home-style profile menu (Graph photo) | `app/components/user-profile-menu.tsx` (shared with TopNav) |
| Explorer (canvases list, Connected row, collapse) | `app/components/app-atlas/explorer.tsx` |
| Connect apps modal (icon grid, status, toggle select) | `app/components/app-atlas/connect-apps-modal.tsx` |
| Canvas graph | `app/components/app-atlas/canvas-flow.tsx`, `screen-node.tsx` |
| Recording | `app/components/app-atlas/recording-view.tsx` |
| SIT / API / Coverage / CI/CD / … | `sit-testing-view.tsx`, `api-testing-view.tsx`, `coverage-overview.tsx`, `cicd-view.tsx`, … |
| Atlas HTTP client | `app/services/appatlas.ts` (`atlasClient`) |
| Types mirroring the API | `app/interfaces/appatlas.ts` |
| URL bases | `app/config/urls.ts` (`APPATLAS_API` = origin + `/atlas-api` on real hosts) |
| Top nav / side nav (non-Atlas) | `app/components/topnav.tsx`, `app/constants/nav-items.ts` |
| Metrics pages | `app/pages/metrics/*` |

Full route and layout detail: [ARCHITECTURE.md](ARCHITECTURE.md). Every call shape: [ENDPOINTS.md](ENDPOINTS.md).
Env vars: [CONFIGURATION.md](CONFIGURATION.md).

---

## App Atlas behaviour a new FE should know

1. **Open from Home** — App Atlas is not in the side nav; Home → App Atlas project → `/app-atlas?projectId=`.
2. **Connect apps** — Icon grid for Jira / Swagger / Teams / GitHub / etc. Toggle to select/unselect. Status under
   icons. Explorer shows a separate **Connected** row of icons (not mixed into the canvas list).
3. **Jira map is async** — `connectJira` may get `202` + `jobId`; the client polls
   `/api/app-atlas/canvases/:id/jira/jobs/:jobId` then reloads the canvas with `GET /canvases/:id?view=lite`.
4. **Lite vs full canvas** — Prefer `view=lite` when opening canvases for snappy UI; full payload when needed.
5. **Profile** — Atlas header uses the same `UserProfileMenu` as Home (Graph photo + name + logout). Do not invent a
   second avatar path.
6. **Presence** — Project room avatars + site-wide heartbeat (`site-presence.tsx`) feed the ops "who's online" view.
7. **Trial flags** — Some tabs (e.g. CI/CD) depend on App Atlas admin settings (`cicdPageTrial`, …). If a tab is
   missing, check the logs dashboard settings, not only FE.

---

## Local setup (short)

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # fill Entra + API URLs + DATABASE_URL
npm run dev                  # http://localhost:3000
```

Register `http://localhost:3000/` as an Entra SPA redirect. Point `NEXT_PUBLIC_APPATLAS_API` at a reachable Atlas
API (CORS allows localhost). Details in the root [README.md](../README.md).

---

## Docs map

| Doc | Audience |
|---|---|
| **This file** | New FE: orientation |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How FE is structured (routes, auth, App Atlas, design choices) |
| [ENDPOINTS.md](ENDPOINTS.md) | Every HTTP call the FE makes |
| [CONFIGURATION.md](CONFIGURATION.md) | Env vars |
| Root [README.md](../README.md) | Features table, stack, deploy |
| Backend [FRONTEND.md](https://github.com/Pro-Test-Consulting-Private-Limited/appatlas-backend/blob/dev/FRONTEND.md) | Atlas API contract for FE |
| Backend [06-operations-dashboard.md](https://github.com/Pro-Test-Consulting-Private-Limited/appatlas-backend/blob/dev/docs/architecture/06-operations-dashboard.md) | logs.protestcorp.com (not this repo) |

---

## Do / don't

| Do | Don't |
|---|---|
| Match dig → promote sit → promote prod | Assume one FE container serves all envs |
| Keep Atlas profile on `UserProfileMenu` | Fork a second profile control |
| Use `atlasClient` + types in `appatlas.ts` | Hand-roll `/atlas-api` URLs with wrong auth |
| Treat shared Atlas backend as cross-env | Expect dig-only BE behaviour after an Atlas deploy |
| Put ops/logs UI changes in **appatlas-backend** `admin-ui` | Look for logs UI under this Next app |

---

## Related product surfaces (Nov 2026)

Shipped on dig/sit (see team ship logs): Connect modal polish, explorer Connected row + collapse motion, shared
profile photo, Metrics seed/labels, async Jira jobs + lite canvas GET, SIT/Coverage/Reports/CI/CD tabs (trial flags
apply). Prod lags until deliberate promote.
