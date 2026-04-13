Create a new API client module in the GSF frontend for a backend router.

Router/resource name: $ARGUMENTS
(e.g. `users` — matches a backend router at `/api/users`)

## Instructions

Read `apps/web/api/datasources.ts` and `apps/web/api/requests.ts` first to understand the existing pattern, then create `apps/web/api/<name>.ts` following the same conventions:

- Use the `requests` wrapper from `apps/web/api/requests.ts` — do **not** import or call axios directly. The wrapper already handles base URL (`PYTHON_API_URL`), error catching, and typed responses.
- Export a named object (e.g. `export const <name> = { ... }`) with one method per endpoint.
- Use the `ResponseWithCount<T>` and `ResponseWithError<T>` wrapper types from `apps/web/api/types.ts`.
- All functions must be typed end-to-end (input params and return type).

Then add the new module to the `apps/web/api/index.ts` barrel (create it if it doesn't exist).

Use Prettier config: tabs, single quotes, semicolons, trailing commas, 100-char print width.

Report the files created and modified.
