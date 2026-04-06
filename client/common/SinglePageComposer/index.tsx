"use client";

import { forwardRef } from "react";
import type { Breadcrumb } from "@/common/Breadcrumbs/Breadcrumbs";

export type SinglePageComposerProps = {
  sections: unknown[];
  header?: {
    header?: Record<string, unknown>;
    errorBanner?: unknown;
  };
  leftPanel?: { bulks: unknown[]; width: string };
  rightPanel?: { bulks: unknown[]; width: string };
  pdfProps?: {
    isPDFView: boolean;
    headerProps: Record<string, unknown>;
  };
  entityUpdatingProperties?: Record<string, string | string[]>;
};

type EditHeaderProps = {
  editMode?: boolean;
  onBeginEdit?: () => void;
  onFinishEdit?: (approve: boolean) => void;
  isLoadingUpdate?: boolean;
};

function sectionTitle(section: unknown): string {
  if (section && typeof section === "object") {
    const o = section as Record<string, unknown>;
    if (typeof o.heading === "string") return o.heading;
    if (typeof o.title === "string") return o.title;
    if (typeof o.id === "string") return o.id;
  }
  return "Section";
}

function breadcrumbsFromPdf(
  headerProps: Record<string, unknown> | undefined,
): Breadcrumb[] {
  const raw = headerProps?.breadcrumbs;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (b): b is Breadcrumb =>
      b !== null &&
      typeof b === "object" &&
      typeof (b as Breadcrumb).name === "string",
  );
}

/**
 * GSF preview composer — real illumex UI lives in
 * `illumex/.../components/common/SinglePageComposer`. This renders the same props
 * in a simple layout so SinglePageView is visible without porting that tree.
 */
export const SinglePageComposer = forwardRef<
  HTMLDivElement,
  SinglePageComposerProps
>(function SinglePageComposer(props, ref) {
  const {
    sections,
    header,
    leftPanel,
    rightPanel,
    pdfProps,
    entityUpdatingProperties,
  } = props;

  const hh = header?.header;
  const title = (hh?.title as string) ?? "Untitled";
  const subtitle = hh?.subtitle as string | undefined;
  const entityId = hh?.entityId as string | undefined;
  const parentId = hh?.parentId as string | undefined;
  const editProps = hh?.editProps as EditHeaderProps | undefined;
  const pdfPageName = (hh?.pdfProps as { pageName?: string } | undefined)
    ?.pageName;
  const handleIsPDF = (hh?.pdfProps as { handleIsPDF?: (v: boolean) => void })
    ?.handleIsPDF;

  const pdfHeader = pdfProps?.headerProps;
  const breadcrumbs = breadcrumbsFromPdf(pdfHeader);
  const isPDFView = pdfProps?.isPDFView ?? false;

  const gridTemplate =
    leftPanel && rightPanel
      ? `[full-start] ${leftPanel.width} [main-start] 1fr [main-end] ${rightPanel.width} [full-end]`
      : leftPanel
        ? `[full-start] ${leftPanel.width} [main-start] 1fr [main-end full-end]`
        : rightPanel
          ? `[full-start main-start] 1fr [main-end] ${rightPanel.width} [full-end]`
          : `[full-start main-start] 1fr [main-end full-end]`;

  if (isPDFView) {
    return (
      <div
        ref={ref}
        className="flex min-h-[50vh] w-full flex-col gap-6 rounded-lg border border-zinc-200 bg-white p-8 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      >
        <div className="border-b border-zinc-200 pb-4 dark:border-zinc-700">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            PDF preview
            {pdfPageName ? (
              <span className="ml-2 font-normal normal-case text-zinc-600 dark:text-zinc-400">
                {pdfPageName}
              </span>
            ) : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            {breadcrumbs.map((b, i) => (
              <span key={b.id ?? `${b.path}-${i}`}>
                {i > 0 ? <span className="mx-1 text-zinc-400">/</span> : null}
                {b.name}
              </span>
            ))}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <ol className="list-decimal space-y-4 pl-5 text-sm">
          {sections.map((s, i) => (
            <li key={i} className="text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">{sectionTitle(s)}</span>
            </li>
          ))}
        </ol>
        {handleIsPDF ? (
          <button
            type="button"
            className="self-start rounded-md bg-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            onClick={() => handleIsPDF(false)}
          >
            Close PDF preview
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="flex w-full min-w-0 flex-col gap-0 rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/40"
    >
      {header?.errorBanner ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {String(header.errorBanner)}
        </div>
      ) : null}

      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-700 dark:bg-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {subtitle}
              </p>
            ) : null}
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-500">
              {entityId ? (
                <div>
                  <dt className="inline font-medium">Entity</dt>{" "}
                  <dd className="inline font-mono text-zinc-700 dark:text-zinc-300">
                    {entityId}
                  </dd>
                </div>
              ) : null}
              {parentId ? (
                <div>
                  <dt className="inline font-medium">Parent</dt>{" "}
                  <dd className="inline font-mono text-zinc-700 dark:text-zinc-300">
                    {parentId}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {handleIsPDF ? (
              <button
                type="button"
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => handleIsPDF(true)}
              >
                PDF preview
              </button>
            ) : null}
            {editProps && editProps.onBeginEdit && editProps.onFinishEdit ? (
              editProps.editMode ? (
                <>
                  <button
                    type="button"
                    disabled={editProps.isLoadingUpdate}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    onClick={() => editProps.onFinishEdit?.(true)}
                  >
                    {editProps.isLoadingUpdate ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    disabled={editProps.isLoadingUpdate}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
                    onClick={() => editProps.onFinishEdit?.(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  onClick={() => editProps.onBeginEdit?.()}
                >
                  Edit
                </button>
              )
            ) : null}
          </div>
        </div>
      </header>

      <div
        className="grid w-full min-w-0 flex-1 gap-0"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {leftPanel ? (
          <aside className="border-r border-zinc-200 bg-white/60 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-400">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Left panel
            </p>
            <p className="text-xs text-zinc-500">
              {leftPanel.bulks.length} bulk(s) · width {leftPanel.width}
            </p>
          </aside>
        ) : null}

        <main className="min-w-0 border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
          <div className="space-y-4">
            {sections.map((section, i) => (
              <section
                key={i}
                className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/30"
              >
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {sectionTitle(section)}
                </h2>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-100 p-2 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {JSON.stringify(section, null, 2)}
                </pre>
              </section>
            ))}
          </div>

          {entityUpdatingProperties &&
          Object.keys(entityUpdatingProperties).length > 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-600">
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                Entity updates (preview)
              </p>
              <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                {Object.entries(entityUpdatingProperties).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200">
                      {k}
                    </span>
                    : {Array.isArray(v) ? v.join(", ") : v}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </main>

        {rightPanel ? (
          <aside className="border-l border-zinc-200 bg-white/60 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-400">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Right panel
            </p>
            <p className="text-xs text-zinc-500">
              {rightPanel.bulks.length} bulk(s) · width {rightPanel.width}
            </p>
          </aside>
        ) : null}
      </div>
    </div>
  );
});
