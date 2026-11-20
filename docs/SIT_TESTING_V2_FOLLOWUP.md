# SIT Testing v2 follow-up (2026-11-20)

## Deployed

| Component | Env | Branch | Commit | Notes |
|-----------|-----|--------|--------|-------|
| frontend | **dev only** | `feature/sit-testing-v2` | `916f451` | `NEXT_PUBLIC_SIT_UI_V2=1` in `~/deploy-env/frontend-dev.env.production` |
| appatlas | all (shared) | `feature/sit-testing-v2` | `3eb6564` | Module/Feature from epic/summary |
| frontend | sit | unchanged | `206651d` | legacy |
| frontend | prod | unchanged | `6ec1ac0` | legacy |

## Escape hatch

```js
localStorage.setItem('sit_ui_v2','0'); location.reload(); // legacy on DEV
localStorage.removeItem('sit_ui_v2'); location.reload();  // back to build default
```

## Rollback

```bash
aihub-deploy frontend dev b87a780   # prior mock-layout commit (or daf4b7d / 7c945df)
# restore env without flag:
cp -a ~/deploy-env/frontend-dev.env.production.bak-sitv2-20261120165053 ~/deploy-env/frontend-dev.env.production
aihub-deploy frontend dev <commit>

aihub-deploy appatlas 217af5b       # prior stream/perf commit before module fix
```

## Smoke workbooks (list only — not deleted)

See operator report; ids created by `sit-v2-smoke`:

- `b68b5cfb552f4e99` — 23 cases — DW-7+DW-11
- `ab4e0aedbac04ee6` — 26 cases — DW-7+DW-11
- `bacddc261d0c4088` — 24 cases — DW-7+DW-11
