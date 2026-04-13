# GSF (Generative Semantic Fabric)

Full-stack monorepo: Next.js frontend (`/apps/web`) + FastAPI backend (`/python`).

## Structure

```
/apps/web/    # Next.js 16 app (React 19, TypeScript, Tailwind CSS 4)
/python/      # FastAPI app (Python 3.11+, uv)
/packages/    # Shared packages (config, types, ui)
```

## Dev Commands

All run from repo root via Turborepo (pnpm workspace includes both `apps/*` and `python`):

| Command | Description |
|---|---|
| `pnpm dev` | Start everything — Next.js on :3000, FastAPI on :3001 |
| `pnpm build` | Build all apps |
| `pnpm lint` | ESLint across all apps |

To run a single app individually:
- Frontend: `pnpm dev` from `apps/web/` — Next.js on port 3000
- Backend: `pnpm dev` from `python/` — `uvicorn app.main:app --reload --host 127.0.0.1 --port 3001`

## Frontend Rules

- **Next.js 16**: Has breaking changes from prior versions. Read `node_modules/next/dist/docs/` before writing Next.js-specific code. See `apps/web/AGENTS.md` for details.
- **Formatting**: Prettier — tabs, single quotes, semicolons, 100 char width, trailing commas. Run `prettier --write` before committing.
- **Linting**: ESLint (Airbnb config). Fix all lint errors; do not disable rules without a comment explaining why.
- **Components**: Arrow function components. No class components.
- **Styling**: Tailwind CSS 4. Do not write inline styles or separate CSS files for component styling.
- **Types**: TypeScript strict mode. No `any` without a comment. Types go in `/types`, enums in `/enums`.
- **Testing**: Vitest + Playwright.
- **API layer**: Use the `requests` wrapper from `apps/web/api/requests.ts` — do not call axios directly. Base URL and error handling are already centralised there.

## Backend Rules

- **Formatting/Linting**: Ruff (line-length: 88). Run `uv run ruff check .` and `uv run ruff format .` from `/python` before committing.
- **Dependencies**: Managed with `uv`. Add dependencies via `uv add`, not pip. Do not edit `pyproject.toml` manually for deps.
- **API prefix**: All routes under `/api/`. Routers live in `python/app/routers/`.
- **Type hints**: Required on all function signatures.

## Git

- Commit messages: concise imperative style, no `Co-Authored-By` trailers.
- Branch from `main`. Current working branch: `fix/architecture`.
