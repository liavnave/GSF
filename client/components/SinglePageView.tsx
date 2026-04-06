"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@nvidia/foundations-react-core";
import {
  SinglePageComposer,
  type SinglePageComposerProps,
} from "@/common/SinglePageComposer";
import { type Breadcrumb } from "@/common/Breadcrumbs/Breadcrumbs";
import { Placeholders } from "@/assets/images/placeholders";

export type SinglePageFormat = SinglePageComposerProps;

export type SinglePageViewProps = {
  dataId: string;
  title: string;
  editMode: boolean;
  hasEditPermission: boolean;
  setEditMode: (editMode: boolean) => void;
  updateEntity: (approve: boolean) => void;
  getSinglePage: (id: string) => Promise<SinglePageFormat>;
  isUpdated: boolean;
  isLoadingUpdate: boolean;
  breadcrumbsPDF: Breadcrumb[];
  parentId?: string;
};

export const SinglePageView = ({
  dataId,
  parentId,
  title,
  editMode,
  setEditMode,
  updateEntity,
  hasEditPermission,
  getSinglePage,
  isUpdated,
  isLoadingUpdate,
  breadcrumbsPDF,
}: SinglePageViewProps): React.JSX.Element => {
  const [loading, setLoading] = useState(false);
  const [props, setProps] = useState<SinglePageFormat | null>(null);
  const [isPDFView, setIsPDFView] = useState(false);
  const refPDF = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await getSinglePage(dataId);
        if (!cancelled) {
          setProps(response);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editMode, dataId, getSinglePage]);

  useEffect(() => {
    if (!isUpdated) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await getSinglePage(dataId);
        if (!cancelled) {
          setProps(response);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isUpdated, dataId, getSinglePage]);

  const editProps = hasEditPermission
    ? {
        editMode,
        onBeginEdit: () => setEditMode(true),
        onFinishEdit: (approve: boolean) => {
          updateEntity(approve);
          setEditMode(false);
        },
        isLoadingUpdate,
      }
    : undefined;

  if (loading) {
    return (
      <div
        className="flex h-full min-h-[12rem] w-full items-center justify-center"
        role="status"
      >
        <Spinner aria-label="Loading" />
      </div>
    );
  }

  if (!props?.sections.length) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-y-auto p-8 text-center">
        <Placeholders.NoResults />
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          We&apos;re sorry, no results found
        </p>
      </div>
    );
  }

  const pdfPageName =
    "All Data-" +
    breadcrumbsPDF.map((br) => br.name).join("-") +
    title;

  return (
    <div className="flex h-full w-full min-h-0 flex-col justify-start overflow-y-auto">
      <SinglePageComposer
        header={{
          header: {
            entityId: dataId,
            parentId,
            title,
            editProps,
            withBorder: true,
            ...props.header?.header,
            pdfProps: {
              handleIsPDF: setIsPDFView,
              refPDF,
              pageName: pdfPageName,
            },
          },
          errorBanner: props.header?.errorBanner,
        }}
        sections={props.sections}
        rightPanel={props?.rightPanel}
        leftPanel={props?.leftPanel}
        entityUpdatingProperties={props?.entityUpdatingProperties}
        ref={refPDF}
        pdfProps={{
          isPDFView,
          headerProps: {
            title,
            breadcrumbs: breadcrumbsPDF,
          },
        }}
      />
    </div>
  );
};
