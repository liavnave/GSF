import { Column, Schema, Table } from '@/types/datasources';

export type ResponseWithError<ValidResponseType> = ValidResponseType & Partial<ApiError>;
export type ApiError = {
	message: string;
	error: boolean;
};

export type ResponseWithCount<T> = {
	data: T;
	count: number;
};

export type SchemasByDbResponse = ResponseWithError<ResponseWithCount<Schema[]>>;
export type TablesBySchemaResponse = ResponseWithError<ResponseWithCount<Table[]>>;
export type ColumnsByTableResponse = ResponseWithError<ResponseWithCount<Column[]>>;
