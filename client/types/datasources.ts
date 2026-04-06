import type { ConnectionType, DataModels, Usage } from "@/enums/datasources";

export interface NameId {
  id: string;
  name: string;
}

export type TableType =
  | typeof DataModels.TABLE
  | typeof DataModels.EXTERNAL_TABLE
  | typeof DataModels.VIEW
  | typeof DataModels.MATERIALIZED;

export interface Tag {
  id: string;
  name: string;
  rule_id?: string;
  dual?: boolean;
  owner_id?: string;
}

export interface SchemaColumn {
  id: string;
  name: string;
  data_type: string;
  description: string;
  last_queried: string | null;
  num_of_aliases: number;
  num_of_attributes: number;
  num_of_const_comparisons: number;
  num_of_field_comparisons: number;
  num_of_queries: number;
  num_of_terms: number;
  db: NameId;
  schema: NameId;
  table: NameId;
  label: DataModels;
  tags: Tag[];
  type: typeof DataModels.COLUMN;
  length: number | null;
  scale: number | null;
  default_value: string | null;
  nullable: boolean;
  owner_notes: string | null;
  syntax_example: string | null;
  usage: Usage;
  num_of_usage: number;
  related_terms: NameId[];
  related_attributes: NameId[];
  description_suggestion?: string;
  deleted?: boolean;
  owner_id?: string | null;
}

export interface SchemaTable {
  id: string;
  name: string;
  description: string;
  last_queried: string;
  num_of_columns: number;
  num_of_queries: number;
  num_of_terms: number;
  num_of_dup: number;
  num_of_filters: number;
  num_of_joins: number;
  num_of_aggregations: number;
  db: NameId;
  schema: NameId;
  type: TableType;
  label: DataModels;
  tags: Tag[];
  columns: SchemaColumn[];
  owner_id: string | null;
  owner_notes: string | null;
  last_modified: string | null;
  created_date: string | null;
  retention_time: number | null;
  row_count: number | null;
  size: number | null;
  related_terms: NameId[];
  num_of_usage: number;
  usage: Usage;
  description_suggestion?: string;
  deleted?: boolean;
}

export interface SchemaEntity {
  id: string;
  added: string;
  description: string | null;
  description_suggestion?: string;
  name: string;
  tables: SchemaTable[];
  num_of_tables: number;
  type: typeof DataModels.SCHEMA;
  owner_id: string | null;
  tags: Tag[];
}

export interface Database {
  id: string;
  name: string;
  added: string;
  pulled: string;
  connector_type: ConnectionType;
  schemas: SchemaEntity[];
  type: typeof DataModels.DB;
  owner_id: string | null;
}
