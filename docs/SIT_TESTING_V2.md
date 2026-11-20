# SIT Testing UI v2

Feature flag (default **OFF**):

- Build/runtime env: `NEXT_PUBLIC_SIT_UI_V2=1`
- Or in the browser console: `localStorage.setItem('sit_ui_v2','1'); location.reload()`
- Disable: `localStorage.removeItem('sit_ui_v2')` or unset the env and rebuild

Legacy UI remains at `app/components/app-atlas/sit-testing-view.tsx`.

Backend additions (additive):

- Migration **24**: `suite_id`, `version`, `generation_mode`, `parent_workbook_id` on `sit_workbooks`
- `POST /sit/generate-stream` (SSE)
- Enriched `GET /sit/tickets` (RCQ counts, notes, generation status)
- Expanded case PATCH + `POST /sit/workbooks/:id/cases`
