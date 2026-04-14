'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Column, Database, Schema, Table } from '@/types/datasources';
import { DataModels } from '@/enums/datasources';
import { datasources } from '@/api/datasources';
import { catalogPathFromFocusId } from '@/lib/data/data-catalog-path';
import { splitSchemaId, splitTableId } from '@/lib/data/catalog-ids';
import {
	applyCatalogBranchPayload,
	catalogStructureFingerprint,
	mergeDatabaseCatalog,
} from '@/lib/data/datasource-tree-merge';

function scheduleTreeDataNotify(
	onTreeDataUpdated: ((dbs: Database[]) => void) | undefined,
	next: Database[],
): void {
	if (!onTreeDataUpdated) return;
	queueMicrotask(() => {
		onTreeDataUpdated(next);
	});
}

function columnSubtreeContainsFocus(column: Column, focusId: string): boolean {
	return column.id === focusId;
}

function tableSubtreeContainsFocus(table: Table, focusId: string): boolean {
	if (table.id === focusId) return true;
	if (table.columns.some((c) => columnSubtreeContainsFocus(c, focusId))) return true;
	return focusId.startsWith(`${table.id}|`);
}

function schemaSubtreeContainsFocus(schema: Schema, focusId: string): boolean {
	if (schema.id === focusId) return true;
	const parts = focusId.split('|');
	if (parts.length < 3) return false;
	return `${parts[0]}|${parts[1]}` === schema.id;
}

function databaseSubtreeContainsFocus(database: Database, focusId: string): boolean {
	if (database.id === focusId) return true;
	const parts = focusId.split('|');
	return parts[0] === database.id;
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

export type DataTreeProps = {
	initialDatabases: Database[];
	selectedId?: string;
	pathBase?: string;
	className?: string;
	onTreeDataUpdated?: (databases: Database[]) => void;
};

function rowClassName(selected: boolean) {
	return `flex min-h-9 cursor-pointer items-center gap-1 rounded-lg text-left text-sm no-underline transition-colors ${
		selected
			? 'bg-emerald-100/95 font-medium text-emerald-950 shadow-sm ring-1 ring-emerald-200/80 dark:bg-emerald-950/45 dark:text-emerald-50 dark:ring-emerald-800/50'
			: 'text-zinc-800 hover:bg-zinc-100/90 dark:text-zinc-200 dark:hover:bg-zinc-800/70'
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
	onClick,
	onActivateBranch,
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
	onClick?: () => void;
	onActivateBranch?: () => void;
}) {
	const pad = 12 + depth * 12;
	const style = { paddingLeft: pad, paddingRight: 12 };

	const metaEl = (
		<span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-400">{meta}</span>
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
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					e.stopPropagation();
					if (hasChildren) onToggle();
				}
			}}
		>
			{loading ? '…' : hasChildren ? (open ? '▼' : '▶') : '·'}
		</span>
	);

	const nameEl = <span className="min-w-0 flex-1 truncate font-medium">{name}</span>;

	const inner = (
		<>
			{chevron}
			{nameEl}
			{metaEl}
		</>
	);

	if (href && !hasChildren) {
		return (
			<Link href={href} prefetch={false} className={rowClassName(selected)} style={style}>
				{inner}
			</Link>
		);
	}

	return (
		<div
			className={rowClassName(selected)}
			style={style}
			onClick={() => {
				if (hasChildren && onActivateBranch) {
					onActivateBranch();
				} else if (hasChildren) {
					onToggle();
				}
				onClick?.();
			}}
		>
			{inner}
		</div>
	);
}

function ColumnBlock({
	depth,
	column,
	selectedId,
	pathBase,
}: {
	depth: number;
	column: Column;
	selectedId?: string;
	pathBase: string;
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
				href={catalogPathFromFocusId(column.id, pathBase)}
			/>
		</div>
	);
}

function TableBlock({
	depth,
	table,
	selectedId,
	pathBase,
	onLoadColumns,
}: {
	depth: number;
	table: Table;
	selectedId?: string;
	pathBase: string;
	onLoadColumns: (tableId: string) => void;
}) {
	const router = useRouter();
	const containsFocus = selectedId != null && tableSubtreeContainsFocus(table, selectedId);
	const [open, setOpen] = useOpenBranch(containsFocus, selectedId, false);
	const fetchedOnce = useRef(false);
	const activateTable = useCallback(() => {
		setOpen(true);
		router.replace(catalogPathFromFocusId(table.id, pathBase), { scroll: false });
	}, [router, pathBase, table.id, setOpen]);

	const hasChildren = table.num_of_columns > 0;

	useEffect(() => {
		if (
			open &&
			!fetchedOnce.current &&
			table.columns.length === 0 &&
			table.num_of_columns > 0
		) {
			fetchedOnce.current = true;
			onLoadColumns(table.id);
		}
	}, [open, table.columns.length, table.num_of_columns, table.id, onLoadColumns]);

	const loading = open && table.columns.length === 0 && table.num_of_columns > 0;

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
				href={hasChildren ? undefined : catalogPathFromFocusId(table.id, pathBase)}
				onActivateBranch={hasChildren ? activateTable : undefined}
			/>
			{open && table.columns.length > 0
				? table.columns.map((col) => (
						<ColumnBlock
							key={col.id}
							depth={depth + 1}
							column={col}
							selectedId={selectedId}
							pathBase={pathBase}
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
	pathBase,
	onLoadColumns,
	onLoadTables,
}: {
	depth: number;
	schema: Schema;
	selectedId?: string;
	pathBase: string;
	onLoadColumns: (tableId: string) => void;
	onLoadTables: (schemaId: string) => Promise<void>;
}) {
	const router = useRouter();
	const containsFocus = selectedId != null && schemaSubtreeContainsFocus(schema, selectedId);
	const [open, setOpen] = useOpenBranch(containsFocus, selectedId, false);
	const hasChildren = (schema.num_of_tables ?? 0) > 0;
	const activateSchema = useCallback(() => {
		setOpen(true);
		router.replace(catalogPathFromFocusId(schema.id, pathBase), { scroll: false });
	}, [router, pathBase, schema.id, setOpen]);
	const [loadingTables, setLoadingTables] = useState(false);

	useEffect(() => {
		if (!open || schema.tables.length > 0 || (schema.num_of_tables ?? 0) === 0) return;
		let cancelled = false;
		void (async () => {
			await Promise.resolve();
			if (cancelled) return;
			setLoadingTables(true);
			try {
				await onLoadTables(schema.id);
			} finally {
				if (!cancelled) setLoadingTables(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [open, schema.id, schema.num_of_tables, schema.tables.length, onLoadTables]);

	return (
		<div>
			<Row
				depth={depth}
				open={open}
				onToggle={() => setOpen((o) => !o)}
				hasChildren={hasChildren}
				loading={loadingTables}
				name={schema.name}
				meta="schema"
				selected={selectedId === schema.id}
				href={hasChildren ? undefined : catalogPathFromFocusId(schema.id, pathBase)}
				onActivateBranch={hasChildren ? activateSchema : undefined}
			/>
			{open && hasChildren
				? schema.tables.map((t) => (
						<TableBlock
							key={t.id}
							depth={depth + 1}
							table={t}
							selectedId={selectedId}
							pathBase={pathBase}
							onLoadColumns={onLoadColumns}
						/>
					))
				: null}
		</div>
	);
}

function DatabaseBlock({
	database,
	selectedId,
	pathBase,
	onLoadColumns,
	onLoadSchemas,
	onLoadTables,
}: {
	database: Database;
	selectedId?: string;
	pathBase: string;
	onLoadColumns: (tableId: string) => void;
	onLoadSchemas: (dbId: string) => Promise<void>;
	onLoadTables: (schemaId: string) => Promise<void>;
}) {
	const router = useRouter();
	const containsFocus = selectedId != null && databaseSubtreeContainsFocus(database, selectedId);
	const [open, setOpen] = useOpenBranch(containsFocus, selectedId, false);
	const hasChildren = (database.num_of_schemas ?? 0) > 0;

	const activateDatabase = useCallback(() => {
		setOpen(true);
		router.replace(catalogPathFromFocusId(database.id, pathBase), { scroll: false });
	}, [router, pathBase, database.id, setOpen]);
	const [loadingSchemas, setLoadingSchemas] = useState(false);

	useEffect(() => {
		if (!open || database.schemas.length > 0 || (database.num_of_schemas ?? 0) === 0) return;
		let cancelled = false;
		void (async () => {
			await Promise.resolve();
			if (cancelled) return;
			setLoadingSchemas(true);
			try {
				await onLoadSchemas(database.id);
			} finally {
				if (!cancelled) setLoadingSchemas(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [open, database.id, database.num_of_schemas, database.schemas.length, onLoadSchemas]);

	return (
		<div>
			<Row
				depth={0}
				open={open}
				onToggle={() => setOpen((o) => !o)}
				hasChildren={hasChildren}
				loading={loadingSchemas}
				name={database.name}
				meta={DataModels.DB}
				selected={selectedId === database.id}
				href={hasChildren ? undefined : catalogPathFromFocusId(database.id, pathBase)}
				onActivateBranch={hasChildren ? activateDatabase : undefined}
			/>
			{open && hasChildren
				? database.schemas.map((s) => (
						<SchemaBlock
							key={s.id}
							depth={1}
							schema={s}
							selectedId={selectedId}
							pathBase={pathBase}
							onLoadColumns={onLoadColumns}
							onLoadTables={onLoadTables}
						/>
					))
				: null}
		</div>
	);
}

export function DataTree({
	initialDatabases,
	selectedId,
	pathBase = '/data',
	className = '',
	onTreeDataUpdated,
}: DataTreeProps) {
	const [databases, setDatabases] = useState<Database[]>(initialDatabases);
	const catalogFpRef = useRef('');

	useEffect(() => {
		const fp = catalogStructureFingerprint(initialDatabases);
		if (fp === catalogFpRef.current) return;
		catalogFpRef.current = fp;
		queueMicrotask(() => {
			setDatabases((prev) => mergeDatabaseCatalog(prev, initialDatabases));
		});
	}, [initialDatabases]);

	const loadSchemasForDatabase = useCallback(
		async (dbId: string) => {
			const res = await datasources.getCatalogBranch(dbId, {}, {});
			if (res.error === true || !res.data) return;
			setDatabases((prev) => {
				const next = applyCatalogBranchPayload(prev, dbId, res.data, {});
				scheduleTreeDataNotify(onTreeDataUpdated, next);
				return next;
			});
		},
		[onTreeDataUpdated],
	);

	const loadTablesForSchema = useCallback(
		async (schemaId: string) => {
			const [dbId, schemaName] = splitSchemaId(schemaId);
			const res = await datasources.getCatalogBranch(dbId, { schemaName }, {});
			if (res.error === true || !res.data) return;
			setDatabases((prev) => {
				const next = applyCatalogBranchPayload(prev, dbId, res.data, { schemaName });
				scheduleTreeDataNotify(onTreeDataUpdated, next);
				return next;
			});
		},
		[onTreeDataUpdated],
	);

	const loadTableColumns = useCallback(
		async (tableId: string) => {
			const [dbId, schemaName, tableName] = splitTableId(tableId);
			const res = await datasources.getCatalogBranch(dbId, { schemaName, tableName }, {});
			if (res.error === true || !res.data) return;
			setDatabases((prev) => {
				const next = applyCatalogBranchPayload(prev, dbId, res.data, {
					schemaName,
					tableName,
				});
				scheduleTreeDataNotify(onTreeDataUpdated, next);
				return next;
			});
		},
		[onTreeDataUpdated],
	);

	const summary = useMemo(
		() => `${databases.length} db · ${databases.map((d) => d.name).join(', ')}`,
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
						pathBase={pathBase}
						onLoadColumns={loadTableColumns}
						onLoadSchemas={loadSchemasForDatabase}
						onLoadTables={loadTablesForSchema}
					/>
				))}
			</nav>
		</div>
	);
}

export default DataTree;
