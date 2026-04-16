import { requests } from './requests';
import type { Column, Database, Schema, Table } from '@/types/datasources';
import type { Params } from '@/types/params';
import type {
	ColumnsByTableResponse,
	ResponseWithCount,
	SchemasByDbResponse,
	TablesBySchemaResponse,
} from './types';

const schemasByDbMap = new Map<string, Promise<SchemasByDbResponse>>();
const tablesBySchemaMap = new Map<string, Promise<TablesBySchemaResponse>>();
const columnsByTableMap = new Map<string, Promise<ColumnsByTableResponse>>();

export const datasources = {
	getDBs: () => requests.get<ResponseWithCount<Database[]>>('datasources/dbs'),

	/** Schemas for one database; parallel callers with the same key share one HTTP request. */
	getSchemasForDatabase: (dbId: string): Promise<SchemasByDbResponse> => {
		const pending = schemasByDbMap.get(dbId);
		if (pending != null) return pending;

		const promise = requests
			.get<ResponseWithCount<Schema[]>>(`schemas/${encodeURIComponent(dbId)}`, {})
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
	): Promise<TablesBySchemaResponse> => {
		const key = [schemaId, opts.databaseName ?? ''].join('\0');
		const pending = tablesBySchemaMap.get(key);
		if (pending != null) return pending;

		const params: Params = {};
		if (opts.databaseName != null && opts.databaseName !== '') {
			params.database_name = opts.databaseName;
		}

		const promise = requests
			.get<ResponseWithCount<Table[]>>(`tables/${encodeURIComponent(schemaId)}`, params)
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
	): Promise<ColumnsByTableResponse> => {
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
			.get<ResponseWithCount<Column[]>>(`columns/${encodeURIComponent(tableId)}`, params)
			.finally(() => {
				columnsByTableMap.delete(key);
			});

		columnsByTableMap.set(key, promise);
		return promise;
	},
};
