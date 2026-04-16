export function splitId(id: string, expectedParts: number): string[] {
	const parts = id.split('|');
	if (parts.length !== expectedParts) {
		throw new Error(`Invalid ID: ${id}. Expected ${expectedParts} part(s) separated by '|'.`);
	}
	return parts;
}
