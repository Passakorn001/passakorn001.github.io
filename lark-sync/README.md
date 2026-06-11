# Lark Sync

Online replacement for the AnyCross workflow.

This project syncs records from one Lark Base table to another Lark Base table. It is designed for GitHub Actions so it can run online on a schedule without keeping a local computer open.

## Setup

1. Create or choose a destination Lark Base table.
2. Add matching destination fields for the fields in `config.example.json`.
3. Create a Lark app and grant it access to source and destination Base tables.
4. Add GitHub repository secrets:
   - `LARK_APP_ID`
   - `LARK_APP_SECRET`
   - `CONFIG_JSON`
5. Keep repository variable `DRY_RUN=true` for the first test.
6. Run the `Lark Sync` workflow manually.
7. Check logs and destination records.
8. Set `DRY_RUN=false` when ready.
9. Choose one completion strategy:
   - `DELETE_AFTER_SYNC=true` to delete source records after a successful create.
   - `MARK_SYNCED=true` plus `afterSync.markSourceRecord` config to mark source records instead.

## Config

Do not commit real config to a public repository. Store the full config JSON in the GitHub secret `CONFIG_JSON`.

`config.example.json` is only a template.

## Field Handling

- `text` extracts plain text from Lark rich text arrays.
- `attachment` preserves attachment objects so file fields can stay as file attachments in a destination Base table.
- `raw` passes the value through.

## Local Test

```powershell
Copy-Item .env.example .env
Copy-Item config.example.json config.json
npm run sync
```

By default, `DRY_RUN=true`, so local runs only print what would be created.
