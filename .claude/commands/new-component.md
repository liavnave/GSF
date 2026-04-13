Create a new React component for the GSF project.

Component name and optional subfolder: $ARGUMENTS

## Instructions

1. Determine the component name and target directory from $ARGUMENTS.
   - If a subfolder is given (e.g. `dataPage/MyComponent`), place the file at `apps/web/components/<subfolder>/<ComponentName>.tsx`.
   - Otherwise place it at `apps/web/components/<ComponentName>.tsx`.

2. Create `<ComponentName>.tsx` following this exact pattern:
   - Include `"use client";` at the top only if the component uses browser APIs, event handlers, useState, useEffect, or other client-side hooks. Omit it for purely presentational components that could be server-rendered.
   - Define a `<ComponentName>Props` interface with JSDoc comments on each prop.
   - Export the component as a named export (not default).
   - Style exclusively with Tailwind CSS classes — no inline styles.
   - Use `useCallback` for event handlers, `useMemo` for expensive derived values.

3. If the component lives inside a subfolder that has an `index.ts` barrel file, add the named export and type export to it.

4. Use the Prettier config: tabs, single quotes, semicolons, trailing commas, 100-char print width.

5. Report the files created and any barrel exports updated.
