import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DataWorkspaceView } from '@/components/dataPage';
import { datasources } from '@/api/datasources';

export const metadata: Metadata = {
	title: 'Data',
};

export default async function DataPage() {
	const res = await datasources.getDBs({});
	const databases = res.error === true ? [] : res.data;
	const error = res.error === true ? (res.message ?? null) : null;

	return (
		<div className="relative flex min-h-screen flex-1 flex-col bg-gradient-to-br from-zinc-100/90 via-white to-emerald-50/40 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950/25">
			<div
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.08),transparent)]"
				aria-hidden
			/>
			<div className="relative mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col py-4 sm:py-6 lg:py-8">
				<Suspense
					fallback={
						<div className="flex min-h-[min(70dvh,560px)] flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-zinc-200/80 bg-white/70 p-12 shadow-lg shadow-zinc-200/30 backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-950/60 dark:shadow-none">
							<div
								className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-600 dark:border-zinc-700 dark:border-t-emerald-400"
								role="status"
								aria-label="Loading"
							/>
							<p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
								Loading workspace…
							</p>
						</div>
					}
				>
					<DataWorkspaceView databases={databases} loadError={error} />
				</Suspense>
			</div>
		</div>
	);
}
