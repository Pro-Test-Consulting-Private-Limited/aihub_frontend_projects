# AppAtlas Design Validation (Figma plugin)

Private/dev plugin that pairs with AI Hub and submits frame trees for deterministic Design Validation audits.

## Install (DEV)

1. Open Figma → **Plugins** → **Development** → **Import plugin from manifest…**
2. Select `figma-plugin/manifest.json` from this repo.
3. In AppAtlas (den): Connect Figma account → Connect apps on a canvas → link a Figma file → **Generate pairing code**.
4. Run the plugin → paste the 6-digit code → select a frame → **Validate selected frame**.
5. Open **Design Validation** tab on that canvas to review score, findings, and Jira dry-run.

## Network

`manifest.json` allows:

- `https://ai-hub-dev.protestcorp.com`
- `https://ai-hub-sit.protestcorp.com`
- `https://ai-hub.protestcorp.com`

## Notes

- Phase 1 checks: text min size, contrast heuristic, touch target size, clipsContent.
- Plugin auth uses a pairing token (`figmap_…`), not Entra inside Figma.
- Jira issue creation from findings is dry-run only until explicitly approved.
