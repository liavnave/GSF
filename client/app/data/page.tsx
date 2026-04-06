import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hello world",
};

export default function DataPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-8">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Hello world
      </h1>
    </div>
  );
}
