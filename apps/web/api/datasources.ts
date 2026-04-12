import { requests } from './requests';
import type {
	Column,
	Database,
	DataFilters,
	Entity,
	NameId,
	Table,
} from '@/types/datasources';
import { ResponseWithCount } from './types';

export const datasources = {
	getDBs: (filters: DataFilters) =>
		requests.get<ResponseWithCount<Database[]>>('datasources/dbs', filters),
	getTablesByDatabaseId: (dbId: string, filters: DataFilters) =>
		requests.get<ResponseWithCount<Table[]>>(`datasources/dbs/${dbId}/tables`, filters),
	getSchemasByDatabaseId: (dbId: string, filters: DataFilters) =>
		requests.get<ResponseWithCount<Entity[]>>(`datasources/dbs/${dbId}`, filters),
	getAllSchemas: () => requests.get<Array<Entity & { db: NameId }>>('datasources/schemas'),
	getTablesBySchemaId: (schemaId: string, filters: DataFilters) =>
		requests.get<ResponseWithCount<Table[]>>(`datasources/schemas/${schemaId}`, filters),
	getColumnsBySchemaId: (schemaId: string, filters: DataFilters) =>
		requests.get<ResponseWithCount<Column[]>>(
			`datasources/schemas/${schemaId}/columns`,
			filters,
		),
	getColumnsByDatabaseId: (dbId: string, filters: DataFilters) =>
		requests.get<ResponseWithCount<Column[]>>(`datasources/dbs/${dbId}/columns`, filters),
	getTableById: (tableId: string) =>
		requests.get<ResponseWithCount<Table>>(`datasources/tables/${tableId}`),
	getColumnById: (column: string) =>
		requests.get<ResponseWithCount<Column>>(`datasources/columns/${column}`),
};
