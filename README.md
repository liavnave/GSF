# GSF

Generative semantic fabric.

## Running locally

The **web app** and the **Python API** must both be running. The `/data` page loads databases through Next.js rewrites to `http://127.0.0.1:8000` (see `client/next.config.ts`).

### One-time setup

1. **Client** — from `client/`:

   ```bash
   cd client && npm install
   ```

2. **API** — create a venv and install dependencies in `server/`:

   ```bash
   cd server && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
   ```

### Start development

**Option A — two terminals**

- Terminal 1 (Next.js, default **port 3001** in this repo):

  ```bash
  cd client && npm run dev
  ```

- Terminal 2 (FastAPI on **port 8000**):

  ```bash
  cd client && npm run dev:api
  ```

**Option B — one command** (Next + API together):

```bash
cd client && npm run dev:stack
```

Then open **http://localhost:3001** (or the port Next prints if 3001 is busy).

If the API is not running, `/data` will show an error such as `ECONNREFUSED 127.0.0.1:8000`.

### Optional

- Override the API URL: set **`PYTHON_API_URL`** (used by Next rewrites and server-side API calls).
