import { requests } from './requests';
import type { CatalogBranchPayload, Database } from '@/types/datasources';
import type { Params } from '@/types/params';
import type { ResponseWithCount, ResponseWithError } from './types';

type CatalogBranchResponse = ResponseWithError<ResponseWithCount<CatalogBranchPayload>>;

/** Coalesce concurrent identical catalog-branch calls (Strict Mode, hydrate + tree, etc.). */
const catalogBranchMap = new Map<string, Promise<CatalogBranchResponse>>();

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
		const pending = catalogBranchMap.get(key);
		if (pending != null) return pending;

		const catalogBranchParams: Params = { db_id: dbId };
		if (opts.schemaName != null && opts.schemaName !== '') {
			catalogBranchParams.schema_name = opts.schemaName;
		}
		if (opts.tableName != null && opts.tableName !== '') {
			catalogBranchParams.table_name = opts.tableName;
		}

		const promise = requests
			.get<
				ResponseWithCount<CatalogBranchPayload>
			>('datasources/dbs/catalog-branch', catalogBranchParams)
			.finally(() => {
				catalogBranchMap.delete(key);
			});

		catalogBranchMap.set(key, promise);
		return promise;
	},
};
