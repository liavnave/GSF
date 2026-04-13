import { DataModels, type Usage } from '@/enums/datasources';

export type NameId = {
	id: string;
	name: string;
};

export type TableType = typeof DataModels.TABLE | typeof DataModels.VIEW;

export type Tag = {
	id: string;
	name: string;
	rule_id?: string;
	dual?: boolean;
};

export type Column = {
	id: string;
	name: string;
	data_type: string;
	description: string;
	last_queried: string | null;
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
	syntax_example: string | null;
	usage: Usage;
	num_of_usage: number;
};

export type Table = {
	id: string;
	name: string;
	description: string;
	last_queried: string;
	num_of_columns: number;
	db: NameId;
	schema: NameId;
	type: TableType;
	label: DataModels;
	tags: Tag[];
	columns: Column[];
	last_modified: string | null;
	created_date: string | null;
	num_of_usage: number;
	usage: Usage;
};

export type Entity = {
	id: string;
	added: string;
	description: string | null;
	name: string;
	tables: Table[];
	num_of_tables: number;
	type: typeof DataModels.SCHEMA;
	tags: Tag[];
};

export type Schema = Entity;

export type Database = {
	id: string;
	name: string;
	added: string;
	pulled: string;
	schemas: Schema[];
	type: typeof DataModels.DB;
};

export type DataFilters = Record<string, string | string[] | undefined>;
