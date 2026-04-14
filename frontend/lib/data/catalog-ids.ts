/** Split pipe-separated catalog ids (matches backend / Neo4j composite keys). */

export function splitSchemaId(schemaId: string): readonly [string, string] {
	const p = schemaId.split('|');
	if (p.length !== 2) {
		throw new Error(`Invalid schema id (expected db|schema): ${schemaId}`);
	}
	return [p[0], p[1]] as const;
}

export function splitTableId(tableId: string): readonly [string, string, string] {
	const p = tableId.split('|');
	if (p.length !== 3) {
		throw new Error(`Invalid table id (expected db|schema|table): ${tableId}`);
	}
	return [p[0], p[1], p[2]] as const;
}

export function encPath(s: string): string {
	return encodeURIComponent(s);
}
