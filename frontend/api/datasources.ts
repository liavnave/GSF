import { requests } from './requests';
import type { Column, Database, Schema, Table } from '@/types/datasources';
import type { Params } from '@/types/params';
import type { ApiResponse, RawColumns, RawSchemaRow, RawSchemasResponse, RawTableRow, ResponseWithCount } from './types';

// ---------------------------------------------------------------------------
// Normalizers: raw server shapes → frontend types
// ---------------------------------------------------------------------------

function normalizeSchema(raw: RawSchemaRow, dbId: string): Schema {
	return {
		id: raw.id,
		name: raw.schema_name,
		database_name: dbId,
		num_of_tables: raw.tables_count,
		tables: [],
	};
}

function normalizeTable(raw: RawTableRow): Table {
	return {
		id: raw.id,
		name: raw.name,
		description: '',
		database_name: raw.db_name,
		schema_name: raw.schema_name,
		num_of_columns: raw.columns_count,
		columns: [],
	};
}

function normalizeColumns(raw: RawColumns): Column[] {
	return (raw.columns ?? []).map((c) => ({
		id: c.column_name,
		name: c.column_name,
		data_type: c.data_type ?? 'unknown',
		database_name: raw.db_name,
		schema_name: raw.schema_name,
		table_name: raw.table_name,
		ordinal_position: c.ordinal_position ?? 0,
	}));
}

// ---------------------------------------------------------------------------
// Request dedup caches
// ---------------------------------------------------------------------------

const schemasByDbMap = new Map<string, Promise<ApiResponse<Schema[]>>>();
const tablesBySchemaMap = new Map<string, Promise<ApiResponse<Table[]>>>();
const columnsByTableMap = new Map<string, Promise<ApiResponse<Column[]>>>();

export const datasources = {
	getDBs: () => requests.get<ResponseWithCount<Database[]>>('datasources/dbs'),

	/** Schemas for one database; parallel callers with the same key share one HTTP request. */
	getSchemasForDatabase: (dbId: string): Promise<ApiResponse<Schema[]>> => {
		const pending = schemasByDbMap.get(dbId);
		if (pending != null) return pending;

		const promise = requests
			.get<RawSchemasResponse>(`schemas/${encodeURIComponent(dbId)}`, {})
		.then((res): ApiResponse<Schema[]> => {
			if (res.error) return res as unknown as ApiResponse<Schema[]>;
				const raw = res as unknown as RawSchemasResponse;
				const schemas = raw.schemas.map((s) => normalizeSchema(s, dbId));
				return { data: schemas, count: raw.schemas_count };
			})
			.finally(() => {
				schemasByDbMap.delete(dbId);
			});

		schemasByDbMap.set(dbId, promise);
		return promise;
	},

	/** Tables for one schema; parallel callers with the same key share one HTTP request. */
	getTablesForSchema: (
		schemaId: string,
		opts: { databaseName?: string } = {},
	): Promise<ApiResponse<Table[]>> => {
		const key = [schemaId, opts.databaseName ?? ''].join('\0');
		const pending = tablesBySchemaMap.get(key);
		if (pending != null) return pending;

		const params: Params = {};
		if (opts.databaseName != null && opts.databaseName !== '') {
			params.database_name = opts.databaseName;
		}

		const promise = requests
			.get<ResponseWithCount<RawTableRow[]>>(`tables/${encodeURIComponent(schemaId)}`, params)
		.then((res): ApiResponse<Table[]> => {
			if (res.error) return res as unknown as ApiResponse<Table[]>;
				const tables = res.data.map(normalizeTable);
				return { data: tables, count: tables.length };
			})
			.finally(() => {
				tablesBySchemaMap.delete(key);
			});

		tablesBySchemaMap.set(key, promise);
		return promise;
	},

	/** Columns for one table; parallel callers with the same key share one HTTP request. */
	getColumnsForTable: (
		tableId: string,
		opts: { databaseName?: string; schemaName?: string } = {},
	): Promise<ApiResponse<Column[]>> => {
		const key = [tableId, opts.databaseName ?? '', opts.schemaName ?? ''].join('\0');
		const pending = columnsByTableMap.get(key);
		if (pending != null) return pending;

		const params: Params = {};
		if (opts.databaseName != null && opts.databaseName !== '') {
			params.database_name = opts.databaseName;
		}
		if (opts.schemaName != null && opts.schemaName !== '') {
			params.schema_name = opts.schemaName;
		}

		const promise = requests
			.get<ResponseWithCount<RawColumns>>(
				`columns/${encodeURIComponent(tableId)}`,
				params,
			)
		.then((res): ApiResponse<Column[]> => {
			if (res.error) return res as unknown as ApiResponse<Column[]>;
				const envelope = res.data as unknown as RawColumns;
				const columns = normalizeColumns(envelope);
				return { data: columns, count: columns.length };
			})
			.finally(() => {
				columnsByTableMap.delete(key);
			});

		columnsByTableMap.set(key, promise);
		return promise;
	},
};
