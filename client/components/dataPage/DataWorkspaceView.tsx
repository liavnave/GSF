"use client";

import { useCallback } from "react";
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
      <div className="flex min-h-[70dvh] flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-red-600 dark:text-red-400">
        <p>Не удалось загрузить базы данных.</p>
        <p className="text-zinc-600 dark:text-zinc-400">{loadError}</p>
      </div>
    );
  }

  if (!workspaceDb) {
    return (
      <div className="flex min-h-[70dvh] flex-1 items-center justify-center p-8 text-sm text-zinc-500">
        API не вернул ни одной базы данных.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[70dvh] flex-1 flex-col">
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
