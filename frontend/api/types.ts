export type ApiError = {
	message: string;
	error: boolean;
};

export type ResponseWithError<T> = T & Partial<ApiError>;

export type ResponseWithCount<T> = {
	data: T;
	count: number;
};

export type ApiResponse<T> = ResponseWithError<ResponseWithCount<T>>;
export type RawSchemaRow = {
	id: string;
	schema_name: string;
	tables_count: number;
};

export type RawSchemasResponse = {
	schemas_count: number;
	schemas: RawSchemaRow[];
};

export type RawTableRow = {
	id: string;
	name: string;
	db_name: string;
	schema_name: string;
	columns_count: number;
};

export type RawColumns = {
	table_name: string;
	schema_name: string;
	db_name: string;
	columns_count: number;
	columns: { ordinal_position: number; column_name: string; data_type: string }[];
};
