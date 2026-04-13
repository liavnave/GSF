# GSF

Generative semantic fabric.

## Running locally

The **frontend** (`frontend/`) and the **Python API** (`gsf/`) must both be running.

### One-time setup

```bash
pnpm install
uv sync
```

### Start development

From the repo root, run each in a separate terminal:

```bash
pnpm dev        # Next.js on port 3000
pnpm dev:api    # FastAPI on port 3001
```

Then open **http://localhost:3000**.

### Optional

- Override the API URL: set **`PYTHON_API_URL`** (used by Next rewrites and server-side API calls).
