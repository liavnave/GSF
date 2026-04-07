import { requests } from "./requests";
import type {
  Column,
  ColumnField,
  Database,
  DataFilters,
  Entity,
  NameId,
  Table,
} from "@/types/datasources";
import { ResponseWithCount } from "./types";

export const datasources = {
  getDBs: (filters: DataFilters) =>
    requests.get<ResponseWithCount<Database[]>>(
      "/api/datasources/dbs",
      filters,
    ),
  getTablesByDatabaseId: (dbId: string, filters: DataFilters) =>
    requests.get<ResponseWithCount<Table[]>>(
      `/api/datasources/dbs/${dbId}/tables`,
      filters,
    ),
  getSchemasByDatabaseId: (dbId: string, filters: DataFilters) =>
    requests.get<ResponseWithCount<Entity[]>>(
      `/api/datasources/dbs/${dbId}`,
      filters,
    ),
  getAllSchemas: () =>
    requests.get<Array<Entity & { db: NameId }>>(
      "/api/datasources/schemas",
    ),
  getTablesBySchemaId: (schemaId: string, filters: DataFilters) =>
    requests.get<ResponseWithCount<Table[]>>(
      `/api/datasources/schemas/${schemaId}`,
      filters,
    ),
  getColumnsBySchemaId: (schemaId: string, filters: DataFilters) =>
    requests.get<ResponseWithCount<Column[]>>(
      `/api/datasources/schemas/${schemaId}/columns`,
      filters,
    ),
  getColumnsByDatabaseId: (dbId: string, filters: DataFilters) =>
    requests.get<ResponseWithCount<Column[]>>(
      `/api/datasources/dbs/${dbId}/columns`,
      filters,
    ),
  getTableById: (tableId: string) =>
    requests.get<ResponseWithCount<Table>>(
      `/api/datasources/tables/${tableId}`,
    ),
  getColumnById: (column: string) =>
    requests.get<ResponseWithCount<Column>>(
      `/api/datasources/columns/${column}`,
    ),
  getFillById: (fillId: string) =>
    requests.get<ResponseWithCount<ColumnField>>(
      `/api/datasources/fills/${fillId}`,
    ),
};
