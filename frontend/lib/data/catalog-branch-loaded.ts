import type { Database } from '@/types/datasources';

/** True when `databases` already contains enough tree data to render `focusId` without fetching catalog-branch. */
export function isCatalogBranchLoadedForFocus(databases: Database[], focusId: string): boolean {
	const parts = focusId.split('|').filter((p) => p.length > 0);
	const dbId = parts[0];
	if (!dbId) return false;

	const db = databases.find((d) => d.id === dbId);
	if (!db) return false;

	if (db.schemas.length === 0) return false;
	if (parts.length === 1) return true;

	const schemaId = `${parts[0]}|${parts[1]}`;
	const sch = db.schemas.find((s) => s.id === schemaId);
	if (!sch) return false;

	if (parts.length === 2) {
		return sch.tables.length > 0 || sch.num_of_tables === 0;
	}

	const tableId = `${parts[0]}|${parts[1]}|${parts[2]}`;
	const tbl = sch.tables.find((t) => t.id === tableId);
	if (!tbl) return false;

	const needsColumns = tbl.num_of_columns > 0 || parts.length === 4;
	return !needsColumns || tbl.columns.length > 0;
}
