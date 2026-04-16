import type { Column, Database, Schema, Table } from '@/types/datasources';

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

/** Upsert columns for one table (merged from columns API). */
export function mergeColumnsIntoTable(
	dbs: Database[],
	tableId: string,
	columns: Column[],
): Database[] {
	return dbs.map((db) => ({
		...db,
		schemas: (db.schemas ?? []).map((s) => ({
			...s,
			tables: (s.tables ?? []).map((t) =>
				t.id === tableId ? { ...t, columns, num_of_columns: columns.length } : t,
			),
		})),
	}));
}

function mergeTable(a: Table, b: Table): Table {
	const aCols = a.columns ?? [];
	const bCols = b.columns ?? [];
	const pickCols = bCols.length > aCols.length ? bCols : aCols.length > 0 ? aCols : bCols;
	return {
		...a,
		...b,
		columns: pickCols,
		num_of_columns: Math.max(a.num_of_columns, b.num_of_columns, pickCols.length),
	};
}

function mergeSchema(a: Schema, b: Schema): Schema {
	const aTables = a.tables ?? [];
	const bTables = b.tables ?? [];
	const byId = new Map(aTables.map((t) => [t.id, t]));
	for (const t of bTables) {
		const ex = byId.get(t.id);
		byId.set(t.id, ex ? mergeTable(ex, t) : t);
	}
	const order = [...aTables.map((t) => t.id)];
	for (const t of bTables) {
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
	const aSchemas = a.schemas ?? [];
	const bSchemas = b.schemas ?? [];
	const byId = new Map(aSchemas.map((s) => [s.id, s]));
	for (const s of bSchemas) {
		const ex = byId.get(s.id);
		byId.set(s.id, ex ? mergeSchema(ex, s) : s);
	}
	const order = [...aSchemas.map((s) => s.id)];
	for (const s of bSchemas) {
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
			const sc = (d.schemas ?? [])
				.map((s) => {
					const tables = s.tables ?? [];
					const tb = tables
						.map((t) => `${t.id}:${(t.columns ?? []).length}`)
						.join(',');
					return `${s.id}:${tables.length}:${tb}`;
				})
				.join(';');
			return `${d.id}:${(d.schemas ?? []).length}:${sc}`;
		})
		.join('|');
}
