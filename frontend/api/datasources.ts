import { requests } from './requests';
import type { Column, Database, Schema, Table } from '@/types/datasources';
import type { Params } from '@/types/params';
import type { ApiResponse, ColumnsEnvelope, ResponseWithCount, SchemasResponse } from './types';

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
			.get<SchemasResponse>(`schemas/${encodeURIComponent(dbId)}`, {})
			.then((res): ApiResponse<Schema[]> => {
				if (res.error) return res as unknown as ApiResponse<Schema[]>;
				const raw = res as unknown as SchemasResponse;
				const schemas: Schema[] = raw.schemas.map((s) => ({ ...s, tables: [] }));
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
			.get<ResponseWithCount<Omit<Table, 'columns'>[]>>(
				`tables/${encodeURIComponent(schemaId)}`,
				params,
			)
			.then((res): ApiResponse<Table[]> => {
				if (res.error) return res as unknown as ApiResponse<Table[]>;
				const tables: Table[] = res.data.map((t) => ({ ...t, columns: [] }));
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
			.get<ResponseWithCount<ColumnsEnvelope>>(
				`columns/${encodeURIComponent(tableId)}`,
				params,
			)
			.then((res): ApiResponse<Column[]> => {
				if (res.error) return res as unknown as ApiResponse<Column[]>;
				const envelope = res.data as unknown as ColumnsEnvelope;
				const columns: Column[] = (envelope.columns ?? []).map((c) => ({
					...c,
					db_name: envelope.db_name,
					schema_name: envelope.schema_name,
					table_name: envelope.table_name,
				}));
				return { data: columns, count: columns.length };
			})
			.finally(() => {
				columnsByTableMap.delete(key);
			});

		columnsByTableMap.set(key, promise);
		return promise;
	},
};
