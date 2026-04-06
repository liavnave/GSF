"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { DataTree, SinglePageView, type SinglePageFormat } from "@/components/dataPage";
import {
  buildTreeFocusPageFormat,
  defaultSinglePageViewProps,
  mockDatabases,
} from "@/app/data/mock-single-page";

function DataPageContent() {
  const searchParams = useSearchParams();
  const treeFocusId = searchParams.get("focus");

  const getSinglePage = useCallback(
    async (
      dataId: string,
      treeFocus: string | null,
    ): Promise<SinglePageFormat> => {
      await new Promise((r) => setTimeout(r, 350));
      const base = buildTreeFocusPageFormat(treeFocus, mockDatabases, dataId);
      return {
        ...base,
        leftPanel: {
          width: "minmax(280px, 32%)",
          bulks: [],
          slot: (
            <DataTree
              databases={mockDatabases}
              selectedId={treeFocus ?? undefined}
              hrefPrefix="/data"
            />
          ),
        },
      };
    },
    [],
  );

  return (
    <div className="flex h-full min-h-[70dvh] flex-1 flex-col">
      <SinglePageView
        dataId={defaultSinglePageViewProps.dataId}
        parentId={defaultSinglePageViewProps.parentId}
        title={defaultSinglePageViewProps.title}
        treeFocusId={treeFocusId}
        getSinglePage={getSinglePage}
      />
    </div>
  );
}

export default function DataPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70dvh] flex-1 items-center justify-center p-8 text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <DataPageContent />
    </Suspense>
  );
}
