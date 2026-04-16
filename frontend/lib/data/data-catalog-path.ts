/**
 * Catalog selection is stored in the `focus` query param: pipe-separated Neo4j element ids
 * from root to node (`dbId|schemaId|tableId|columnId`). Truncated prefixes address ancestors.
 */

export function catalogPathFromFocusId(focusId: string, pathBase = '/data'): string {
	const base = pathBase.endsWith('/') ? pathBase.slice(0, -1) : pathBase;
	const trimmed = focusId.trim();
	if (trimmed === '') return base;
	return `${base}?focus=${encodeURIComponent(trimmed)}`;
}
