"use client";

import { useCallback, useState } from "react";
import {
  SinglePageView,
  type SinglePageFormat,
} from "@/components/SinglePageView";
import {
  defaultSinglePageViewProps,
  mockSinglePageFormat,
} from "@/app/data/mock-single-page";

export default function DataPage() {
  const [editMode, setEditMode] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const [isLoadingUpdate, setIsLoadingUpdate] = useState(false);

  const getSinglePage = useCallback(async (id: string): Promise<SinglePageFormat> => {
    await new Promise((r) => setTimeout(r, 350));
    const data = structuredClone(mockSinglePageFormat);
    const header = data.header?.header;
    if (header && typeof header === "object") {
      (header as Record<string, unknown>).entityId = id;
    }
    return data;
  }, []);

  const updateEntity = useCallback((approve: boolean) => {
    setIsLoadingUpdate(true);
    void (async () => {
      await new Promise((r) => setTimeout(r, 400));
      setIsLoadingUpdate(false);
      if (approve) {
        setIsUpdated(true);
        setTimeout(() => setIsUpdated(false), 100);
      }
    })();
  }, []);

  return (
    <SinglePageView
      dataId={defaultSinglePageViewProps.dataId}
      parentId={defaultSinglePageViewProps.parentId}
      title={defaultSinglePageViewProps.title}
      editMode={editMode}
      setEditMode={setEditMode}
      updateEntity={updateEntity}
      hasEditPermission={defaultSinglePageViewProps.hasEditPermission}
      getSinglePage={getSinglePage}
      isUpdated={isUpdated}
      isLoadingUpdate={isLoadingUpdate}
      breadcrumbsPDF={[...defaultSinglePageViewProps.breadcrumbsPDF]}
    />
  );
}
