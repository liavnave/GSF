Run all linters for the GSF project and report results.

Scope (optional): $ARGUMENTS
Leave blank to lint everything. Pass `client` or `server` to lint only that side.

## Instructions

Run the appropriate commands based on $ARGUMENTS:

**Frontend (client)** — run from repo root:
```bash
pnpm lint
```

**Backend (server)** — run from repo root:
```bash
uv run ruff check gsf/
```

Run both unless $ARGUMENTS specifies only one side.

After running:
- Report any errors and warnings clearly, grouped by file.
- If there are fixable issues, ask the user whether to auto-fix them (`eslint --fix` for JS/TS, `uv run ruff check --fix .` for Python).
- Do not auto-fix without confirmation.
