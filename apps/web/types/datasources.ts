export type NameId = {
	id: string;
	name: string;
};

export type Column = {
	id: string;
	name: string;
	data_type: string;
	database_name: string;
	schema_name: string;
	table_name: string;
	ordinal_position: number;
};

export type Table = {
	id: string;
	name: string;
	description: string;
	database_name: string;
	schema_name: string;
	num_of_columns: number;
	columns: Column[];
};

export type Schema = {
	id: string;
	name: string;
	database_name: string;
	num_of_tables: number;
	tables: Table[];
};

export type Database = {
	id: string;
	name: string;
	schemas: Schema[];
};

export type DataFilters = Record<string, string | string[] | undefined>;
