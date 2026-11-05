# App Atlas: SIT Testing + Teams

Implemented on **`aihub_frontend_projects`** / **`aihub-frontend-sit`**, on the App Atlas page  
(`/app-atlas?projectId=…`).

## SIT Testing

| Placement | Behaviour |
| --- | --- |
| Top nav | **SIT Testing** between API Testing and Coverage |
| Explorer | Under the selected canvas, **below API Testing** (or below screens if no Swagger): “SIT Testing · Jira → cases + data” |
| Centre | Tickets, generate / workbook sheets, Coverage test depth + Priority/Severity |

## Microsoft Teams

Two steps (same Entra / Microsoft account as AI Hub; not a second Teams login):

| Where | What |
| --- | --- |
| **Integrations → Connect Teams** | One-time account connect. Requests Graph scopes and stores provider `teams` for the user. |
| **Canvas → Connect apps → Microsoft Teams** | Canvas **owner** picks a **team** then a **channel** from lists (no raw IDs). Stores link on the canvas. |
| **Jira ticket panel** | **Post to Teams** on clarification questions (uses linked channel). |

### Graph scopes (Entra admin)

On the AI Hub app registration, add delegated scopes and **Grant admin consent**:

- `User.Read` (login)
- `Team.ReadBasic.All` (list teams)
- `Channel.ReadBasic.All` (list channels)
- `ChannelMessage.Send` (post)

No bot, no client secret, no inbound webhook for this phase.

### APIs

- `GET /teams` + `X-Graph-Access-Token` → joined teams
- `GET /teams/:teamId/channels` + token → channels
- `POST/DELETE /canvases/:id/teams` → link / unlink (owner only)
- `POST /canvases/:id/teams/messages` → send

## Ship order

1. **ai-hub-dev** first  
2. Promote to SIT / prod after Entra consent on those app registrations and a smoke test of Connect → picker → Post
