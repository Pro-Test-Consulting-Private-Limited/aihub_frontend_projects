# AppAtlas Design Validation (Figma plugin)

**Optional designer-side entry.** QA visual compare and WCAG-style checks in AppAtlas use the Figma **PAT** (Integrations) and do **not** require this plugin.

Use the plugin when someone is designing *inside Figma* and wants feedback on the selected frame immediately.

## Two flows

| Flow | Where | Auth | Purpose |
|------|--------|------|---------|
| AppAtlas ↔ Figma | Design Validation tab | PAT on Integrations | Pull frames via REST API, design checks, visual diff vs crawled screens/states |
| Figma → AppAtlas | This plugin | Pairing code | In-Figma WCAG-style feedback while designing |

## Install (DEV) — plugin only

1. Open Figma → **Plugins** → **Development** → **Import plugin from manifest…**
2. Select `figma-plugin/manifest.json` from this repo.
3. In AppAtlas (den): Connect Figma account → Connect apps on a canvas → link a Figma file → **Generate pairing code**.
4. Run the plugin → paste the 6-digit code → select a frame → **Validate selected frame**.
5. Open **Design Validation** → Saved audits.

## Network

`manifest.json` allows:

- `https://ai-hub-dev.protestcorp.com`
- `https://ai-hub-sit.protestcorp.com`
- `https://ai-hub.protestcorp.com`

## Notes

- Phase 1 checks: text min size, contrast heuristic, touch target size, clipsContent.
- Plugin auth uses a pairing token (`figmap_…`), not Entra inside Figma.
- Jira issue creation from findings is dry-run only until explicitly approved.
