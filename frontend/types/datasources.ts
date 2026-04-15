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
	/** Populated on expand; 0 means no schemas. */
	num_of_schemas: number;
	schemas: Schema[];
};

/** Response body inside `data` from GET .../dbs/catalog-branch?db_id=... */
export type CatalogBranchPayload = {
	/** All databases (light rows); keeps multi-db tree in sync in one response. */
	dbs: Database[];
	schemas: Schema[];
	tables?: Table[];
	columns?: Column[];
};
