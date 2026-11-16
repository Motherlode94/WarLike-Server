# WarLike Horror Database v1

This is a **proposed**, isolated D1 schema, not an applied production migration. It adds eight prefixed tables without changing existing WarLike account or content tables. The repo currently uses Drizzle migrations in `drizzle/`; integrate this SQL into the established migration mechanism only after reviewing the deployed schema and migration journal. Avoid applying SQL manually in production without a verified backup and staging test.

## Responsibilities

- D1: games, creatures, model/audio/texture metadata, behavior graph metadata, game-to-creature relationships and story chapters/events.
- R2: actual GLB/textures/audio. The `horror_assets.r2_key` field references the R2 object key, not a public URL.
- Server API: authenticated reads and owner/editor-authorized writes, parameterized statements, validation of metadata fields and R2 object ownership.
- Engine/Library: client integrations still required.

The seeded walker, mutant brute and crawler are **metadata only**: no GLB, textures, clips or sound files have been uploaded or verified. CHAMBRE 07 has optional disabled associations; other games may register their own links independently.

## Verification before rollout

1. Run the SQL against a disposable SQLite or D1 staging database, twice (idempotence).
2. Check `PRAGMA foreign_key_check;` and table constraints.
3. Integrate into versioned Drizzle migration and deploy staging.
4. Implement guarded CRUD APIs and signed/authorized R2 uploads.
5. Test authorizations, export, backup, image/model loading and cross-game isolation.

Do not expose raw SQL, untrusted behavior graph evaluation, or R2 write credentials in browser clients.
