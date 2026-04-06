import type { SinglePageComposerProps } from "@/common/SinglePageComposer";
import type { Breadcrumb } from "@/common/Breadcrumbs/Breadcrumbs";

export type SinglePageFormat = SinglePageComposerProps;

/** Static defaults for `SinglePageView` demo — swap for API-driven values later. */
export const defaultSinglePageViewProps = {
  dataId: "mock-entity-001",
  parentId: "mock-parent-root",
  title: "Sample entity",
  hasEditPermission: true,
  breadcrumbsPDF: [
    { name: "All Data", path: "/data" },
    { name: "Workspace", path: "/data/workspace" },
    { name: "Entities", path: "/data/workspace/entities" },
  ] satisfies Breadcrumb[],
} as const;

/** Payload returned by `getSinglePage` for the mock. */
export const mockSinglePageFormat: SinglePageFormat = {
  sections: [
    { id: "overview", heading: "Overview" },
    { id: "metadata", heading: "Metadata" },
  ],
  header: {
    header: {
      subtitle: "Mock single-page payload",
    },
  },
};
