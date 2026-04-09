# GSF (Generative Semantic Fabric)

Full-stack monorepo: Next.js frontend (`/client`) + FastAPI backend (`/server`).

## Structure

```
/client/    # Next.js 16 app (React 19, TypeScript, Tailwind CSS 4)
/server/    # FastAPI app (Python 3.11+, uv)
```

## Dev Commands

All run from `/client`:

| Command | Description |
|---|---|
| `npm run dev` | Next.js on port 3001 |
| `npm run dev:api` | FastAPI on port 8000 |
| `npm run dev:stack` | Both simultaneously |
| `npm run lint` | ESLint |
| `npm run storybook` | Storybook on port 6006 |

From `/server`: `uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`

## Frontend Rules

- **Next.js 16**: Has breaking changes from prior versions. Read `node_modules/next/dist/docs/` before writing Next.js-specific code. See `client/CLAUDE.md` for details.
- **Formatting**: Prettier — tabs, single quotes, semicolons, 100 char width, trailing commas. Run `prettier --write` before committing.
- **Linting**: ESLint (Airbnb config). Fix all lint errors; do not disable rules without a comment explaining why.
- **Components**: Arrow function components. No class components.
- **Styling**: Tailwind CSS 4. Do not write inline styles or separate CSS files for component styling.
- **Types**: TypeScript strict mode. No `any` without a comment. Types go in `/types`, enums in `/enums`.
- **Testing**: Vitest + Playwright. New components should have stories in `/stories`.

## Backend Rules

- **Formatting/Linting**: Ruff (line-length: 88). Run `uv run ruff check` and `uv run ruff format` before committing.
- **Dependencies**: Managed with `uv`. Add dependencies via `uv add`, not pip. Do not edit `pyproject.toml` manually for deps.
- **API prefix**: All routes under `/api/`. Routers live in `server/app/routers/`.
- **Type hints**: Required on all function signatures.

## Git

- Commit messages: concise imperative style, no `Co-Authored-By` trailers.
- Branch from `main`. Current working branch: `feature/create-architecture`.
