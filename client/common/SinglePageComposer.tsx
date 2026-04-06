"use client";

import { forwardRef, type ReactNode } from "react";
import type { Breadcrumb } from "@/types/breadcrumbs";
import {
  isComposerSection,
  type ComposerSection,
} from "@/types/composer-section";

export type SinglePageComposerProps = {
  sections: unknown[];
  header?: {
    header?: Record<string, unknown>;
    errorBanner?: unknown;
  };
  leftPanel?: { bulks: unknown[]; width: string; slot?: ReactNode };
  rightPanel?: { bulks: unknown[]; width: string; slot?: ReactNode };
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
  if (isComposerSection(section)) return section.title;
  if (section && typeof section === "object") {
    const o = section as Record<string, unknown>;
    if (typeof o.heading === "string") return o.heading;
    if (typeof o.title === "string") return o.title;
    if (typeof o.id === "string") return o.id;
  }
  return "Section";
}

function renderComposerSection(section: ComposerSection): ReactNode {
  switch (section.kind) {
    case "textCard":
      return (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {section.title}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {section.body}
          </p>
        </div>
      );
    case "infoGrid":
      return (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {section.title}
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {section.items.map((item) => (
              <div
                key={item.label}
                className="rounded-md border border-zinc-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950/80"
              >
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {item.label}
                </dt>
                <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case "dataTable":
      return (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {section.title}
          </h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/80">
                <tr>
                  {section.columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    {section.columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-3 py-2 text-zinc-800 dark:text-zinc-200"
                      >
                        {row[col.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    default:
      return null;
  }
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
  console.log('SinglePageComposer');
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
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/40"
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
        className="grid w-full min-h-[min(55vh,520px)] min-w-0 flex-1 gap-0"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {leftPanel ? (
          <aside className="flex min-h-0 min-w-0 flex-col border-r border-zinc-200 bg-white/60 dark:border-zinc-700 dark:bg-zinc-950/60">
            {leftPanel.slot ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2">
                {leftPanel.slot}
              </div>
            ) : (
              <div className="p-3 text-sm text-zinc-600 dark:text-zinc-400">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Left panel
                </p>
                <p className="text-xs text-zinc-500">
                  {leftPanel.bulks.length} bulk(s) · width {leftPanel.width}
                </p>
              </div>
            )}
          </aside>
        ) : null}

        <main className="min-h-0 min-w-0 overflow-y-auto border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
          {sections.length === 0 ? (
            <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/20">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Nothing selected
              </p>
              <p className="max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
                Choose a database, schema, table, or column in the tree on the
                left to load description, owner notes, information, and child
                entities.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((section, i) =>
                isComposerSection(section) ? (
                  <div key={section.id}>{renderComposerSection(section)}</div>
                ) : (
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
                ),
              )}
            </div>
          )}

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
          <aside className="flex min-h-0 min-w-0 flex-col border-l border-zinc-200 bg-white/60 dark:border-zinc-700 dark:bg-zinc-950/60">
            {rightPanel.slot ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2">
                {rightPanel.slot}
              </div>
            ) : (
              <div className="p-3 text-sm text-zinc-600 dark:text-zinc-400">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Right panel
                </p>
                <p className="text-xs text-zinc-500">
                  {rightPanel.bulks.length} bulk(s) · width {rightPanel.width}
                </p>
              </div>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
});
