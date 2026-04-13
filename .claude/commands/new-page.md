Create a new Next.js page in the GSF project.

Route path: $ARGUMENTS
(e.g. `settings` creates `apps/web/app/settings/page.tsx`, `settings/profile` creates `apps/web/app/settings/profile/page.tsx`)

## Instructions

1. Parse the route from $ARGUMENTS. Create the directory `apps/web/app/<route>/`.

2. Create `page.tsx` as a **server component** (no `"use client"`) unless the page requires browser-only interactivity:
   ```tsx
   import type { Metadata } from 'next';

   export const metadata: Metadata = {
   	title: '<Page Title>',
   };

   export default async function <RouteName>Page() {
   	return (
   		<div className="flex flex-col flex-1">
   			{/* page content */}
   		</div>
   	);
   }
   ```

3. If the page fetches data, use the `apps/web/api/` layer (see `apps/web/api/datasources.ts` for the pattern). Wrap async data in a `<Suspense>` boundary with a fallback.

4. If a persistent layout is needed for this route, create `layout.tsx` alongside `page.tsx`.

5. Style exclusively with Tailwind CSS. No inline styles.

6. Use Prettier config: tabs, single quotes, semicolons, trailing commas, 100-char print width.

7. Report the files created.
