import type { CatalogBranchPayload, Column, Database, Schema, Table } from '@/types/datasources';

export function mergeSchemasIntoDatabase(
	dbs: Database[],
	dbId: string,
	schemas: Schema[],
): Database[] {
	return dbs.map((db) => (db.id === dbId ? { ...db, schemas } : db));
}

export function mergeTablesIntoSchema(
	dbs: Database[],
	schemaId: string,
	tables: Table[],
): Database[] {
	return dbs.map((db) => ({
		...db,
		schemas: db.schemas.map((s) => (s.id === schemaId ? { ...s, tables } : s)),
	}));
}

/** Merge fresh DB roots from API with already-expanded `schemas` trees in memory. */
export function mergeDatabaseRootsFromPayload(fresh: Database[], prev: Database[]): Database[] {
	const prevById = new Map(prev.map((d) => [d.id, d]));
	return fresh.map((d) => {
		const old = prevById.get(d.id);
		if (!old) return d;
		return { ...d, schemas: old.schemas };
	});
}

/** Apply one catalog-branch API response onto the database list. */
export function applyCatalogBranchPayload(
	dbs: Database[],
	dbId: string,
	payload: CatalogBranchPayload,
	branch: { schemaName?: string; tableName?: string },
): Database[] {
	const nextRoots = mergeDatabaseRootsFromPayload(payload.dbs, dbs);
	let next = mergeSchemasIntoDatabase(nextRoots, dbId, payload.schemas);
	const { schemaName, tableName } = branch;
	if (payload.tables != null && schemaName !== undefined && schemaName !== '') {
		next = mergeTablesIntoSchema(next, `${dbId}|${schemaName}`, payload.tables);
	}
	if (payload.columns != null && schemaName && tableName) {
		next = mergeColumnsIntoTable(next, `${dbId}|${schemaName}|${tableName}`, payload.columns);
	}
	return next;
}

/** Upsert columns for one table (merged from catalog-branch payload). */
export function mergeColumnsIntoTable(
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

function mergeTable(a: Table, b: Table): Table {
	const pickCols =
		b.columns.length > a.columns.length
			? b.columns
			: a.columns.length > 0
				? a.columns
				: b.columns;
	return {
		...a,
		...b,
		columns: pickCols,
		num_of_columns: Math.max(a.num_of_columns, b.num_of_columns, pickCols.length),
	};
}

function mergeSchema(a: Schema, b: Schema): Schema {
	const byId = new Map(a.tables.map((t) => [t.id, t]));
	for (const t of b.tables) {
		const ex = byId.get(t.id);
		byId.set(t.id, ex ? mergeTable(ex, t) : t);
	}
	const order = [...a.tables.map((t) => t.id)];
	for (const t of b.tables) {
		if (!order.includes(t.id)) order.push(t.id);
	}
	const tables = order.map((id) => byId.get(id)!);
	return {
		...a,
		...b,
		tables,
		num_of_tables: Math.max(a.num_of_tables, b.num_of_tables, tables.length),
	};
}

function mergeDb(a: Database, b: Database): Database {
	const byId = new Map(a.schemas.map((s) => [s.id, s]));
	for (const s of b.schemas) {
		const ex = byId.get(s.id);
		byId.set(s.id, ex ? mergeSchema(ex, s) : s);
	}
	const order = [...a.schemas.map((s) => s.id)];
	for (const s of b.schemas) {
		if (!order.includes(s.id)) order.push(s.id);
	}
	const schemas = order.map((id) => byId.get(id)!);
	return {
		...a,
		...b,
		schemas,
		num_of_schemas: Math.max(a.num_of_schemas, b.num_of_schemas, schemas.length),
	};
}

/** Deep-merge catalog trees so prefetch + lazy expansion both keep richest node data. */
export function mergeDatabaseCatalog(prev: Database[], incoming: Database[]): Database[] {
	if (incoming.length === 0) return prev;
	const byId = new Map(prev.map((d) => [d.id, d]));
	for (const inc of incoming) {
		const cur = byId.get(inc.id);
		byId.set(inc.id, cur ? mergeDb(cur, inc) : inc);
	}
	const order = [...prev.map((d) => d.id)];
	for (const d of incoming) {
		if (!order.includes(d.id)) order.push(d.id);
	}
	return order.map((id) => byId.get(id)!);
}

/** Cheap fingerprint for syncing explorer state when the parent ref gains new API data. */
export function catalogStructureFingerprint(dbs: Database[]): string {
	return dbs
		.map((d) => {
			const sc = d.schemas
				.map((s) => {
					const tb = s.tables.map((t) => `${t.id}:${t.columns.length}`).join(',');
					return `${s.id}:${s.tables.length}:${tb}`;
				})
				.join(';');
			return `${d.id}:${d.schemas.length}:${sc}`;
		})
		.join('|');
}
