Create a new API client module in the GSF frontend for a backend router.

Router/resource name: $ARGUMENTS
(e.g. `users` — matches a backend router at `/api/users`)

## Instructions

Read `client/api/datasources.ts` first to understand the existing pattern, then create `client/api/<name>.ts` following the same conventions:

- Use `axios` for HTTP requests.
- Export typed request functions, one per endpoint.
- Use the `ResponseWithError<T>` and `ResponseWithCount<T>` wrapper types from `client/api/types.ts`.
- The base URL should read from `process.env.NEXT_PUBLIC_API_URL` with a fallback to `''` (so Next.js rewrites handle it in dev).
- All functions should be `async` and return typed responses.
- Handle errors by catching axios errors and returning `{ error: true, message: string }`.

Then add the new module to the `client/api/index.ts` barrel (or create it if it doesn't exist).

Use Prettier config: tabs, single quotes, semicolons, trailing commas, 100-char print width.

Report the files created and modified.
