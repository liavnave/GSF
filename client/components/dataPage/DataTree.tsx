"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  Column,
  ColumnField,
  Database,
  Schema,
  Table,
} from "@/types/datasources";
import { DataModels } from "@/enums/datasources";

export type DataTreeProps = {
  databases: Database[];
  selectedId?: string;
  hrefPrefix?: string;
  className?: string;
};

function rowClassName(selected: boolean) {
  return `flex min-h-8 cursor-pointer items-center gap-1 rounded-md text-left text-sm no-underline transition-colors ${
    selected
      ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-50"
      : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
  }`;
}

function Row({
  depth,
  open,
  onToggle,
  hasChildren,
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
  name: string;
  meta: string;
  selected: boolean;
  href?: string;
  /** Для веток: ссылка на `?focus=` по имени; раскрытие — только по шеврону. */
  branchHref?: string;
  onClick?: () => void;
}) {
  const pad = 8 + depth * 14;
  const style = { paddingLeft: pad, paddingRight: 8 };

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
      {hasChildren ? (open ? "▼" : "▶") : "·"}
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

function FieldRows({
  depth,
  fills,
  selectedId,
  hrefPrefix,
}: {
  depth: number;
  fills: ColumnField[];
  selectedId?: string;
  hrefPrefix: string;
}) {
  return (
    <>
      {fills.map((fill) => (
        <Row
          key={fill.id}
          depth={depth}
          open={false}
          onToggle={() => {}}
          hasChildren={false}
          name={fill.name}
          meta="field"
          selected={selectedId === fill.id}
          href={`${hrefPrefix}?focus=${encodeURIComponent(fill.id)}`}
        />
      ))}
    </>
  );
}

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
  const [open, setOpen] = useState(false);
  const fills = column.fills ?? [];
  const hasChildren = fills.length > 0;
  return (
    <div>
      <Row
        depth={depth}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        hasChildren={hasChildren}
        name={column.name}
        meta="col"
        selected={selectedId === column.id}
        href={
          hasChildren ? undefined : `${hrefPrefix}?focus=${encodeURIComponent(column.id)}`
        }
        branchHref={
          hasChildren
            ? `${hrefPrefix}?focus=${encodeURIComponent(column.id)}`
            : undefined
        }
      />
      {open && hasChildren ? (
        <FieldRows
          depth={depth + 1}
          fills={fills}
          selectedId={selectedId}
          hrefPrefix={hrefPrefix}
        />
      ) : null}
    </div>
  );
}

function TableBlock({
  depth,
  table,
  selectedId,
  hrefPrefix,
}: {
  depth: number;
  table: Table;
  selectedId?: string;
  hrefPrefix: string;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = table.columns.length > 0;
  return (
    <div>
      <Row
        depth={depth}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        hasChildren={hasChildren}
        name={table.name}
        meta="table"
        selected={selectedId === table.id}
        href={
          hasChildren ? undefined : `${hrefPrefix}?focus=${encodeURIComponent(table.id)}`
        }
        branchHref={
          hasChildren
            ? `${hrefPrefix}?focus=${encodeURIComponent(table.id)}`
            : undefined
        }
      />
      {open && hasChildren
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

function SchemaBlock({
  depth,
  schema,
  selectedId,
  hrefPrefix,
}: {
  depth: number;
  schema: Schema;
  selectedId?: string;
  hrefPrefix: string;
}) {
  const [open, setOpen] = useState(false);
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
          hasChildren ? undefined : `${hrefPrefix}?focus=${encodeURIComponent(schema.id)}`
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
            />
          ))
        : null}
    </div>
  );
}

function DatabaseBlock({
  database,
  selectedId,
  hrefPrefix,
}: {
  database: Database;
  selectedId?: string;
  hrefPrefix: string;
}) {
  const [open, setOpen] = useState(true);
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
            />
          ))
        : null}
    </div>
  );
}

export function DataTree({
  databases,
  selectedId,
  hrefPrefix = "/data",
  className = "",
}: DataTreeProps) {
  const summary = useMemo(
    () =>
      `${databases.length} db · ${databases.map((d) => d.connector_type).join(", ")}`,
    [databases],
  );

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950 ${className}`}
    >
      <div className="shrink-0 border-b border-zinc-200 px-2 py-2 dark:border-zinc-700">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Data sources
        </p>
        <p className="truncate text-xs text-zinc-400" title={summary}>
          {summary}
        </p>
      </div>
      <nav
        className="min-h-0 flex-1 overflow-y-auto py-1"
        aria-label="Datasource tree"
      >
        {databases.map((database) => (
          <DatabaseBlock
            key={database.id}
            database={database}
            selectedId={selectedId}
            hrefPrefix={hrefPrefix}
          />
        ))}
      </nav>
    </div>
  );
}

export default DataTree;
