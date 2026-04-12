"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  Column,
  Database,
  Schema,
  Table,
} from "@/types/datasources";
import { DataModels } from "@/enums/datasources";
import { datasources } from "@/api/datasources";

// ---------------------------------------------------------------------------
// Focus helpers
// ---------------------------------------------------------------------------

function columnSubtreeContainsFocus(column: Column, focusId: string): boolean {
  return column.id === focusId;
}

function tableSubtreeContainsFocus(table: Table, focusId: string): boolean {
  if (table.id === focusId) return true;
  return table.columns.some((c) => columnSubtreeContainsFocus(c, focusId));
}

function schemaSubtreeContainsFocus(schema: Schema, focusId: string): boolean {
  if (schema.id === focusId) return true;
  return schema.tables.some((t) => tableSubtreeContainsFocus(t, focusId));
}

function databaseSubtreeContainsFocus(database: Database, focusId: string): boolean {
  if (database.id === focusId) return true;
  return database.schemas.some((s) => schemaSubtreeContainsFocus(s, focusId));
}

function useOpenBranch(
  containsFocus: boolean,
  selectedId: string | undefined,
  defaultOpen: boolean,
) {
  const [open, setOpen] = useState(() => defaultOpen || containsFocus);
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId);
  if (selectedId !== prevSelectedId) {
    setPrevSelectedId(selectedId);
    if (containsFocus) setOpen(true);
  }
  return [open, setOpen] as const;
}

// ---------------------------------------------------------------------------
// State updater
// ---------------------------------------------------------------------------

function mergeColumnsIntoTable(
  dbs: Database[],
  tableId: string,
  columns: Column[],
): Database[] {
  return dbs.map((db) => ({
    ...db,
    schemas: db.schemas.map((s) => ({
      ...s,
      tables: s.tables.map((t) =>
        t.id === tableId ? { ...t, columns, num_of_columns: columns.length } : t,
      ),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type DataTreeProps = {
  /**
   * Initial db → schema → table tree (no columns).
   * DataTree owns its own state and lazy-loads columns per table.
   */
  initialDatabases: Database[];
  selectedId?: string;
  hrefPrefix?: string;
  className?: string;
  /** Notifies parent after columns are fetched so it can update its own ref. */
  onTableColumnsLoaded?: (tableId: string, columns: Column[]) => void;
};

// ---------------------------------------------------------------------------
// Row UI primitive
// ---------------------------------------------------------------------------

function rowClassName(selected: boolean) {
  return `flex min-h-9 cursor-pointer items-center gap-1 rounded-lg text-left text-sm no-underline transition-colors ${
    selected
      ? "bg-emerald-100/95 font-medium text-emerald-950 shadow-sm ring-1 ring-emerald-200/80 dark:bg-emerald-950/45 dark:text-emerald-50 dark:ring-emerald-800/50"
      : "text-zinc-800 hover:bg-zinc-100/90 dark:text-zinc-200 dark:hover:bg-zinc-800/70"
  }`;
}

function Row({
  depth,
  open,
  onToggle,
  hasChildren,
  loading,
  name,
  meta,
  selected,
  href,
  branchHref,
  onClick,
}: {
  depth: number;
  open: boolean;
  onToggle: () => void;
  hasChildren: boolean;
  loading?: boolean;
  name: string;
  meta: string;
  selected: boolean;
  href?: string;
  branchHref?: string;
  onClick?: () => void;
}) {
  const pad = 12 + depth * 12;
  const style = { paddingLeft: pad, paddingRight: 12 };

  const metaEl = (
    <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-400">
      {meta}
    </span>
  );

  const chevron = (
    <span
      role="button"
      tabIndex={0}
      className="inline-flex w-4 shrink-0 cursor-pointer items-center justify-center rounded text-[10px] text-zinc-400 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
      onClick={(e) => {
        e.stopPropagation();
        if (hasChildren) onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          if (hasChildren) onToggle();
        }
      }}
    >
      {loading ? "…" : hasChildren ? (open ? "▼" : "▶") : "·"}
    </span>
  );

  const nameEl =
    branchHref != null && branchHref !== "" ? (
      <Link
        href={branchHref}
        className="min-w-0 flex-1 truncate font-medium text-inherit no-underline hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {name}
      </Link>
    ) : (
      <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
    );

  const inner = (
    <>
      {chevron}
      {nameEl}
      {metaEl}
    </>
  );

  if (href && !hasChildren) {
    return (
      <Link href={href} className={rowClassName(selected)} style={style}>
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={rowClassName(selected)}
      style={style}
      onClick={() => onClick?.()}
    >
      {inner}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ColumnBlock
// ---------------------------------------------------------------------------

function ColumnBlock({
  depth,
  column,
  selectedId,
  hrefPrefix,
}: {
  depth: number;
  column: Column;
  selectedId?: string;
  hrefPrefix: string;
}) {
  const containsFocus = selectedId != null && column.id === selectedId;
  const [open, setOpen] = useOpenBranch(containsFocus, selectedId, false);
  return (
    <div>
      <Row
        depth={depth}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        hasChildren={false}
        name={column.name}
        meta="col"
        selected={selectedId === column.id}
        href={`${hrefPrefix}?focus=${encodeURIComponent(column.id)}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TableBlock — lazy-loads columns on first expand
// ---------------------------------------------------------------------------

function TableBlock({
  depth,
  table,
  selectedId,
  hrefPrefix,
  onLoadColumns,
}: {
  depth: number;
  table: Table;
  selectedId?: string;
  hrefPrefix: string;
  onLoadColumns: (tableId: string) => void;
}) {
  const containsFocus =
    selectedId != null && tableSubtreeContainsFocus(table, selectedId);
  const [open, setOpen] = useOpenBranch(containsFocus, selectedId, false);
  const [fetchedOnce, setFetchedOnce] = useState(false);

  // Use real count from DB — columns[] is populated lazily.
  const hasChildren = table.num_of_columns > 0;

  useEffect(() => {
    if (
      open &&
      !fetchedOnce &&
      table.columns.length === 0 &&
      table.num_of_columns > 0
    ) {
      setFetchedOnce(true);
      onLoadColumns(table.id);
    }
  }, [open, fetchedOnce, table.columns.length, table.num_of_columns, table.id, onLoadColumns]);

  const loading =
    open && fetchedOnce && table.columns.length === 0 && table.num_of_columns > 0;

  return (
    <div>
      <Row
        depth={depth}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        hasChildren={hasChildren}
        loading={loading}
        name={table.name}
        meta="table"
        selected={selectedId === table.id}
        href={
          hasChildren
            ? undefined
            : `${hrefPrefix}?focus=${encodeURIComponent(table.id)}`
        }
        branchHref={
          hasChildren
            ? `${hrefPrefix}?focus=${encodeURIComponent(table.id)}`
            : undefined
        }
      />
      {open && table.columns.length > 0
        ? table.columns.map((col) => (
            <ColumnBlock
              key={col.id}
              depth={depth + 1}
              column={col}
              selectedId={selectedId}
              hrefPrefix={hrefPrefix}
            />
          ))
        : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SchemaBlock
// ---------------------------------------------------------------------------

function SchemaBlock({
  depth,
  schema,
  selectedId,
  hrefPrefix,
  onLoadColumns,
}: {
  depth: number;
  schema: Schema;
  selectedId?: string;
  hrefPrefix: string;
  onLoadColumns: (tableId: string) => void;
}) {
  const containsFocus =
    selectedId != null && schemaSubtreeContainsFocus(schema, selectedId);
  const [open, setOpen] = useOpenBranch(containsFocus, selectedId, false);
  const hasChildren = schema.tables.length > 0;
  return (
    <div>
      <Row
        depth={depth}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        hasChildren={hasChildren}
        name={schema.name}
        meta="schema"
        selected={selectedId === schema.id}
        href={
          hasChildren
            ? undefined
            : `${hrefPrefix}?focus=${encodeURIComponent(schema.id)}`
        }
        branchHref={
          hasChildren
            ? `${hrefPrefix}?focus=${encodeURIComponent(schema.id)}`
            : undefined
        }
      />
      {open && hasChildren
        ? schema.tables.map((t) => (
            <TableBlock
              key={t.id}
              depth={depth + 1}
              table={t}
              selectedId={selectedId}
              hrefPrefix={hrefPrefix}
              onLoadColumns={onLoadColumns}
            />
          ))
        : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DatabaseBlock
// ---------------------------------------------------------------------------

function DatabaseBlock({
  database,
  selectedId,
  hrefPrefix,
  onLoadColumns,
}: {
  database: Database;
  selectedId?: string;
  hrefPrefix: string;
  onLoadColumns: (tableId: string) => void;
}) {
  const containsFocus =
    selectedId != null && databaseSubtreeContainsFocus(database, selectedId);
  const [open, setOpen] = useOpenBranch(containsFocus, selectedId, true);
  const hasChildren = database.schemas.length > 0;
  return (
    <div>
      <Row
        depth={0}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        hasChildren={hasChildren}
        name={database.name}
        meta={DataModels.DB}
        selected={selectedId === database.id}
        href={
          hasChildren
            ? undefined
            : `${hrefPrefix}?focus=${encodeURIComponent(database.id)}`
        }
        branchHref={
          hasChildren
            ? `${hrefPrefix}?focus=${encodeURIComponent(database.id)}`
            : undefined
        }
      />
      {open && hasChildren
        ? database.schemas.map((s) => (
            <SchemaBlock
              key={s.id}
              depth={1}
              schema={s}
              selectedId={selectedId}
              hrefPrefix={hrefPrefix}
              onLoadColumns={onLoadColumns}
            />
          ))
        : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataTree (root)
// ---------------------------------------------------------------------------

export function DataTree({
  initialDatabases,
  selectedId,
  hrefPrefix = "/data",
  className = "",
  onTableColumnsLoaded,
}: DataTreeProps) {
  const [databases, setDatabases] = useState<Database[]>(initialDatabases);

  const loadTableColumns = useCallback(
    async (tableId: string) => {
      const res = await datasources.getTableById(tableId);
      if (res.error === true || !res.data) return;
      const loadedTable = res.data as Table;
      const columns = loadedTable.columns ?? [];
      setDatabases((prev) => mergeColumnsIntoTable(prev, tableId, columns));
      onTableColumnsLoaded?.(tableId, columns);
    },
    [onTableColumnsLoaded],
  );

  const summary = useMemo(
    () =>
      `${databases.length} db · ${databases.map((d) => d.connector_type).join(", ")}`,
    [databases],
  );

  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent ${className}`}
    >
      <div className="shrink-0 border-b border-zinc-200/80 bg-gradient-to-r from-emerald-50/80 to-transparent px-4 py-3.5 sm:px-5 dark:border-zinc-700 dark:from-emerald-950/40">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800/90 dark:text-emerald-400/90">
          Explorer
        </p>
        <p
          className="mt-1 truncate text-xs leading-snug text-zinc-500 dark:text-zinc-400"
          title={summary}
        >
          {summary}
        </p>
      </div>
      <nav
        className="flex min-h-0 flex-1 flex-col gap-y-1 overflow-y-auto px-3 py-2 sm:px-4"
        aria-label="Datasource tree"
      >
        {databases.map((database) => (
          <DatabaseBlock
            key={database.id}
            database={database}
            selectedId={selectedId}
            hrefPrefix={hrefPrefix}
            onLoadColumns={loadTableColumns}
          />
        ))}
      </nav>
    </div>
  );
}

export default DataTree;