# GSF

Generative semantic fabric.

## Running locally

This is a **Turborepo** monorepo managed by **pnpm**. The **web app** (`apps/web`) and the **Python API** (`python/`) must both be running. The `/data` page loads databases through Next.js rewrites to `http://127.0.0.1:8000` (see `apps/web/next.config.ts`).

### One-time setup

```bash
pnpm install
```

The Python API uses [uv](https://docs.astral.sh/uv/) — dependencies are installed automatically on first run.

### Start development

From the repo root:

```bash
pnpm dev
```

This runs **Turborepo**, which starts both services in parallel:

- **Next.js** on **port 3001**
- **FastAPI** on **port 8000**

Then open **http://localhost:3001**.

If the API is not running, `/data` will show an error such as `ECONNREFUSED 127.0.0.1:8000`.

### Optional

- Override the API URL: set **`PYTHON_API_URL`** (used by Next rewrites and server-side API calls).
