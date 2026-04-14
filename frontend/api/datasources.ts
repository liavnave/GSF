import { requests } from './requests';
import type { CatalogBranchPayload, Database, DataFilters } from '@/types/datasources';
import { encPath } from '@/lib/data/catalog-ids';
import type { ResponseWithCount, ResponseWithError } from './types';

type CatalogBranchResponse = ResponseWithError<ResponseWithCount<CatalogBranchPayload>>;

/** Coalesce concurrent identical catalog-branch calls (Strict Mode, hydrate + tree, etc.). */
const catalogBranchInflight = new Map<string, Promise<CatalogBranchResponse>>();

function catalogBranchRequestKey(
	dbId: string,
	opts: { schemaName?: string; tableName?: string },
	filters: DataFilters,
): string {
	const filterBits = Object.entries(filters)
		.filter(([, v]) => v !== undefined && v !== '')
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : String(v)}`)
		.join('&');
	return [
		dbId,
		opts.schemaName ?? '',
		opts.tableName ?? '',
		filterBits,
	].join('\0');
}

export const datasources = {
	getDBs: (filters: DataFilters) =>
		requests.get<ResponseWithCount<Database[]>>('datasources/dbs', filters),

	/**
	 * Single catalog API: schemas for db; pass schemaName and/or tableName to include
	 * tables and columns for that path. Parallel callers with the same key share one HTTP request.
	 */
	getCatalogBranch: (
		dbId: string,
		opts: { schemaName?: string; tableName?: string } = {},
		filters: DataFilters = {},
	): Promise<CatalogBranchResponse> => {
		const key = catalogBranchRequestKey(dbId, opts, filters);
		const pending = catalogBranchInflight.get(key);
		if (pending != null) return pending;

		const promise = requests
			.get<ResponseWithCount<CatalogBranchPayload>>(
				`datasources/dbs/${encPath(dbId)}/catalog-branch`,
				{
					...filters,
					...(opts.schemaName != null && opts.schemaName !== ''
						? { schema_name: opts.schemaName }
						: {}),
					...(opts.tableName != null && opts.tableName !== ''
						? { table_name: opts.tableName }
						: {}),
				},
			)
			.finally(() => {
				catalogBranchInflight.delete(key);
			});

		catalogBranchInflight.set(key, promise);
		return promise;
	},
};
