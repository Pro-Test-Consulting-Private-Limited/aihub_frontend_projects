# SIT Testing UI v2

## Feature flag

Priority (first match wins):

1. `localStorage.sit_ui_v2 === "0"` → **force legacy** (escape hatch on DEV)
2. `localStorage.sit_ui_v2 === "1"` → force v2
3. Build env `NEXT_PUBLIC_SIT_UI_V2=1` → v2
4. Otherwise → legacy

**DEV** ships with `NEXT_PUBLIC_SIT_UI_V2=1` baked into `frontend-dev` via `~/deploy-env/frontend-dev.env.production`. Prod and SIT frontends stay on legacy unless their own env is changed.

Browser console escape on DEV:

```js
localStorage.setItem('sit_ui_v2','0'); location.reload(); // legacy
localStorage.removeItem('sit_ui_v2'); location.reload();  // back to build default (v2 on DEV)
```

Legacy UI remains at `app/components/app-atlas/sit-testing-view.tsx`.

## Layout (designer mock)

- Main page: toolbar (Jira Tickets, Edit, Clear All, Quality, Generate) + meta row + full-height spreadsheet grid.
- Jira epic/ticket hierarchy opens only from **Jira Tickets** (dimmed + blurred modal).
- No flat “Saved SIT runs” list on the main page; versions live in picker rows + Generate dialog.
- Dead Test Finder is a compact toolbar popover (`Quality: N flagged`), not a strip that pushes the grid.

## Module / Feature

Deterministic (never model-chosen):

- **Module** = Jira epic name, max 2 meaningful words
- **Feature** = ticket summary with `WALLET-xxx:` / Jira-key prefix stripped, max 2 words

Applied on new generations (backend) and as display-level remap when opening old workbooks (frontend; stored cells are not rewritten).

## Backend (additive)

- Migration **24**: `suite_id`, `version`, `generation_mode`, `parent_workbook_id` on `sit_workbooks`
- `POST /sit/generate-stream` (SSE)
- Enriched `GET /sit/tickets` (RCQ counts, notes, generation status)
- Expanded case PATCH + `POST /sit/workbooks/:id/cases`
