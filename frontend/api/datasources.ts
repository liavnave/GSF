import { requests } from './requests';
import type { CatalogBranchPayload, Database } from '@/types/datasources';
import type { ResponseWithCount, ResponseWithError } from './types';

type CatalogBranchResponse = ResponseWithError<ResponseWithCount<CatalogBranchPayload>>;

/** Coalesce concurrent identical catalog-branch calls (Strict Mode, hydrate + tree, etc.). */
const catalogBranchInflight = new Map<string, Promise<CatalogBranchResponse>>();

function catalogBranchRequestKey(
	dbId: string,
	opts: { schemaName?: string; tableName?: string },
): string {
	return [dbId, opts.schemaName ?? '', opts.tableName ?? ''].join('\0');
}

export const datasources = {
	getDBs: () => requests.get<ResponseWithCount<Database[]>>('datasources/dbs'),

	/**
	 * Single catalog API: schemas for db; pass schemaName and/or tableName to include
	 * tables and columns for that path. Parallel callers with the same key share one HTTP request.
	 */
	getCatalogBranch: (
		dbId: string,
		opts: { schemaName?: string; tableName?: string } = {},
	): Promise<CatalogBranchResponse> => {
		const key = catalogBranchRequestKey(dbId, opts);
		const pending = catalogBranchInflight.get(key);
		if (pending != null) return pending;

		const promise = requests
			.get<ResponseWithCount<CatalogBranchPayload>>('datasources/dbs/catalog-branch', {
				db_id: dbId,
				...(opts.schemaName != null && opts.schemaName !== ''
					? { schema_name: opts.schemaName }
					: {}),
				...(opts.tableName != null && opts.tableName !== ''
					? { table_name: opts.tableName }
					: {}),
			})
			.finally(() => {
				catalogBranchInflight.delete(key);
			});

		catalogBranchInflight.set(key, promise);
		return promise;
	},
};
