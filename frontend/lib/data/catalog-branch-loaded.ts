import type { Database } from '@/types/datasources';

function focusParts(focusId: string): string[] {
	return focusId.split('|').filter((p) => p.length > 0);
}

/** True when `databases` already contains enough tree data to render `focusId` without fetching catalog APIs. */
export function isCatalogBranchLoadedForFocus(databases: Database[], focusId: string): boolean {
	const parts = focusParts(focusId);
	const dbId = parts[0];
	if (!dbId) return false;

	const db = databases.find((d) => d.id === dbId);
	if (!db) return false;

	if (parts.length === 1) {
		return db.schemas.length > 0 || db.num_of_schemas === 0;
	}

	const schemaId = parts[1];
	const sch = db.schemas.find((s) => s.id === schemaId);
	if (!sch) return false;

	if (parts.length === 2) {
		return sch.tables.length > 0 || sch.tables_count === 0;
	}

	const tableId = parts[2];
	const tbl = sch.tables.find((t) => t.id === tableId);
	if (!tbl) return false;

	if (parts.length === 3) {
		return true;
	}

	const needsColumns = tbl.columns_count > 0;
	return !needsColumns || tbl.columns.length > 0;
}
