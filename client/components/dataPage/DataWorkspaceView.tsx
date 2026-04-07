"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DataTree } from "./DataTree";
import { SinglePageView, type SinglePageFormat } from "./SinglePageView";
import type { Database } from "@/types/datasources";
import {
  WORKSPACE_ROOT_PARENT_ID,
  buildTreeFocusPageFormat,
} from "@/lib/data/tree-focus-page";

export type DataWorkspaceViewProps = {
  databases: Database[];
  loadError: string | null;
};

/** Клиентская оболочка страницы `/data`: поисковый параметр `focus`, дерево и SinglePageView. */
export function DataWorkspaceView({ databases, loadError }: DataWorkspaceViewProps) {
  const searchParams = useSearchParams();
  const treeFocusId = searchParams.get("focus");

  const workspaceDb = databases[0];
  const workspaceDataId = workspaceDb?.id ?? "";
  const workspaceTitle = workspaceDb?.name ?? "Data";

  const getSinglePage = useCallback(
    async (
      dataId: string,
      treeFocus: string | null,
    ): Promise<SinglePageFormat> => {
      await new Promise((r) => setTimeout(r, 350));
      const base = buildTreeFocusPageFormat(treeFocus, databases, dataId);
      return {
        ...base,
        leftPanel: {
          width: "minmax(280px, 32%)",
          bulks: [],
          slot: (
            <DataTree
              databases={databases}
              selectedId={treeFocus ?? undefined}
              hrefPrefix="/data"
            />
          ),
        },
      };
    },
    [databases],
  );

  if (loadError) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-200/80 bg-white/90 px-8 py-10 shadow-xl shadow-red-100/50 dark:border-red-900/50 dark:bg-zinc-950/80 dark:shadow-none">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-2xl dark:bg-red-950/80"
            aria-hidden
          >
            ⚠
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-red-800 dark:text-red-300">
            Couldn&apos;t load databases
          </h2>
          <p className="mt-2 text-sm text-red-700/90 dark:text-red-400/90">
            Check that the API is running{" "}
            <code className="rounded bg-red-100/80 px-1.5 py-0.5 font-mono text-xs dark:bg-red-950/80">
              npm run dev:api
            </code>{" "}
            or{" "}
            <code className="rounded bg-red-100/80 px-1.5 py-0.5 font-mono text-xs dark:bg-red-950/80">
              npm run dev:stack
            </code>
            .
          </p>
          <pre className="mt-4 max-w-full overflow-x-auto rounded-lg border border-red-100 bg-red-50/80 p-3 text-left text-xs text-red-900/80 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
            {loadError}
          </pre>
        </div>
      </div>
    );
  }

  if (!workspaceDb) {
    return (
      <div className="flex min-h-[min(70dvh,520px)] flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300/80 bg-white/60 p-12 text-center dark:border-zinc-600 dark:bg-zinc-950/40">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          No databases returned
        </p>
        <p className="max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
          The API responded with an empty list. Add a datasource or check your
          mock data.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[min(70dvh,520px)] flex-1 flex-col gap-6">
      <header className="shrink-0 px-3 sm:px-4">
        <Link
          href="/"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400"
        >
          <span
            className="inline-block transition-transform group-hover:-translate-x-0.5"
            aria-hidden
          >
            ←
          </span>
          Home
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4 !px-[20px] !py-0">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
              Data catalog
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Browse schemas, tables, and columns. Select any node in the tree to
              inspect metadata and lineage.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            {workspaceDb.connector_type}
          </div>
        </div>
      </header>
      <SinglePageView
        dataId={workspaceDataId}
        parentId={WORKSPACE_ROOT_PARENT_ID}
        title={workspaceTitle}
        treeFocusId={treeFocusId}
        getSinglePage={getSinglePage}
      />
    </div>
  );
}
