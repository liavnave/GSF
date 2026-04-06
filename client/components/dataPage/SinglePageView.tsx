"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@nvidia/foundations-react-core";
import {
  SinglePageComposer,
  type SinglePageComposerProps,
} from "@/common/SinglePageComposer";

export type SinglePageFormat = SinglePageComposerProps;

export type SinglePageViewProps = {
  dataId: string;
  title: string;
  getSinglePage: (
    dataId: string,
    treeFocusId: string | null,
  ) => Promise<SinglePageFormat>;
  treeFocusId?: string | null;
  parentId?: string;
};

export const SinglePageView = ({
  dataId,
  parentId,
  title,
  getSinglePage,
  treeFocusId = null,
}: SinglePageViewProps): React.JSX.Element | null => {
  const [loading, setLoading] = useState(true);
  const [props, setProps] = useState<SinglePageFormat | null>(null);
console.log('SinglePageView');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await getSinglePage(dataId, treeFocusId);
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
  }, [dataId, getSinglePage, treeFocusId]);

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

  if (!props) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col justify-start overflow-hidden">
      <SinglePageComposer
        header={{
          header: {
            entityId: dataId,
            parentId,
            title,
            withBorder: true,
            ...props.header?.header,
          },
          errorBanner: props.header?.errorBanner,
        }}
        sections={props.sections}
        rightPanel={props?.rightPanel}
        leftPanel={props?.leftPanel}
        entityUpdatingProperties={props?.entityUpdatingProperties}
      />
    </div>
  );
};
