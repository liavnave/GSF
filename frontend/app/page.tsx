import Link from 'next/link';

export default function Home() {
	return (
		<div className="flex flex-col flex-1 items-center justify-center gap-6 bg-zinc-50 font-sans dark:bg-black">
			<h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Home page</h1>
			<Link
				href="/data"
				className="inline-flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
			>
				Click me
			</Link>
		</div>
	);
}
