# App Atlas: SIT Testing + Teams clarifications

Implemented on **`aihub_frontend_projects`** (this repo), on the App Atlas page  
(`/app-atlas?projectId=…`) — not on `ai-accelerators-fe`.

Matches the SIT Testing UI/UX brief and the Teams/clarifications architecture.

## SIT Testing

| Placement | Behaviour |
| --- | --- |
| Top nav | **SIT Testing** between API Testing and Coverage |
| Explorer | Under the selected canvas, **below API Testing** (or below screens if no Swagger): “SIT Testing · Jira → cases + data” |
| Centre | Epic → expandable tickets, **one ticket** select, **Generate Test Cases + Test Data**, spreadsheet sheets (Test Cases / Test Data / Traceability placeholder), shared **Confirmed ID** UUID |

API (App Atlas backend): `GET /sit/tickets`, `POST /sit/generate`, workbooks. Stub generator until `SIT_GENERATE_URL` / Hugging Face.

## Requirement clarifications → Teams

| Placement | Behaviour |
| --- | --- |
| Connect apps modal | **Microsoft Teams** enabled (same Entra sign-in). **Link channel** stores `teamId` / `channelId` on the canvas |
| Jira ticket panel | **Post to Teams** on ready clarification questions |

Tokens: App Atlas ID token for API; Graph `ChannelMessage.Send` only when linking/posting — not a second Teams login.

## Files

- `app/components/app-atlas/sit-testing-view.tsx`
- `app/components/app-atlas/atlas-workspace.tsx`, `explorer.tsx`, `connect-apps-modal.tsx`, `jira-panel.tsx`
- `app/services/appatlas.ts`, `app/interfaces/appatlas.ts`
- `app/lib/msal.ts`, `app/lib/auth-client.ts`

## Entra admin

On the AI Hub app registration: Graph delegated **`ChannelMessage.Send`** + **Grant admin consent**.
