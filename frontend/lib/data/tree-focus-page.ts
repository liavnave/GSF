import type { SinglePageFormat } from '@/components/dataPage/SinglePageView';
import type { Column, Database, Schema, Table } from '@/types/datasources';
import type { ComposerSection } from '@/types/composer-section';
import { isCatalogBranchLoadedForFocus } from '@/lib/data/catalog-branch-loaded';

export const WORKSPACE_ROOT_PARENT_ID = 'workspace-root';

export type TreeResolved =
	| { kind: 'none' }
	| { kind: 'loading' }
	| { kind: 'db'; db: Database }
	| { kind: 'schema'; db: Database; schema: Schema }
	| { kind: 'table'; db: Database; schema: Schema; table: Table }
	| {
			kind: 'column';
			db: Database;
			schema: Schema;
			table: Table;
			column: Column;
	  };

function inColumns(
	db: Database,
	schema: Schema,
	table: Table,
	focusId: string,
): TreeResolved | null {
	for (const column of table.columns) {
		if (column.id === focusId) {
			return { kind: 'column', db, schema, table, column };
		}
	}
	return null;
}

function inTables(db: Database, schema: Schema, focusId: string): TreeResolved | null {
	for (const table of schema.tables) {
		if (table.id === focusId) {
			return { kind: 'table', db, schema, table };
		}
		const c = inColumns(db, schema, table, focusId);
		if (c) return c;
	}
	return null;
}

function inSchemas(db: Database, focusId: string): TreeResolved | null {
	for (const schema of db.schemas) {
		if (schema.id === focusId) {
			return { kind: 'schema', db, schema };
		}
		const t = inTables(db, schema, focusId);
		if (t) return t;
	}
	return null;
}

function treePendingColumnFocus(focusId: string, databases: Database[]): TreeResolved {
	const parts = focusId.split('|');
	if (parts.length !== 4) return { kind: 'none' };
	const dbId = parts[0];
	if (!dbId || !databases.some((d) => d.id === dbId)) return { kind: 'none' };
	if (isCatalogBranchLoadedForFocus(databases, focusId)) return { kind: 'none' };
	return { kind: 'loading' };
}

export function resolveTreeNode(focusId: string | null, databases: Database[]): TreeResolved {
	if (!focusId) return { kind: 'none' };
	for (const db of databases) {
		if (db.id === focusId) return { kind: 'db', db };
		const s = inSchemas(db, focusId);
		if (s) return s;
	}
	return treePendingColumnFocus(focusId, databases);
}

function baseCardsForEntity(
	description: string,
	items: { label: string; value: string }[],
): ComposerSection[] {
	return [
		{
			kind: 'textCard',
			id: 'description',
			title: 'Description',
			body: description,
		},
		{
			kind: 'infoGrid',
			id: 'information',
			title: 'Information',
			items,
		},
	];
}

export function buildTreeFocusPageFormat(
	focusId: string | null,
	databases: Database[],
	workspaceDataId: string,
): SinglePageFormat {
	const resolvedFocus = resolveTreeNode(focusId, databases);

	if (resolvedFocus.kind === 'loading') {
		const sections: ComposerSection[] = [
			{
				kind: 'loadingPanel',
				id: 'tree-focus-loading',
				message: 'Loading catalog details…',
			},
		];
		return {
			sections,
			header: {
				header: {
					title: 'Loading…',
					subtitle: 'Catalog',
				},
			},
		};
	}

	if (resolvedFocus.kind === 'none') {
		const sections: ComposerSection[] = [
			{
				kind: 'textCard',
				id: 'catalog-intro',
				title: 'Catalog',
				body:
					databases.length === 0
						? 'No databases are available yet.'
						: 'Choose a database in the tree or pick one from the table below.',
			},
		];
		if (databases.length > 0) {
			sections.push({
				kind: 'dataTable',
				id: 'all-databases',
				title: `Databases (${databases.length})`,
				columns: [
					{ key: 'name', label: 'Name' },
					{ key: 'schemas', label: 'Schemas' },
				],
				rows: databases.map((d) => ({
					name: d.name,
					schemas: String(d.num_of_schemas),
				})),
			});
		}
		return {
			sections,
			header: {
				header: {
					title: 'All Data',
					subtitle: 'Select a database, schema, table, or column in the tree.',
				},
			},
		};
	}

	const sections: ComposerSection[] = [];

	switch (resolvedFocus.kind) {
		case 'db': {
			sections.push(
				...baseCardsForEntity(
					`Warehouse connection ${resolvedFocus.db.name}. ${resolvedFocus.db.schemas.length} schema(s) available.`,
					[{ label: 'Schemas', value: String(resolvedFocus.db.schemas.length) }],
				),
			);
			sections.push({
				kind: 'dataTable',
				id: 'child-schemas',
				title: `Schemas (${resolvedFocus.db.schemas.length})`,
				columns: [
					{ key: 'name', label: 'Name' },
					{ key: 'tables', label: 'Tables' },
				],
				rows: resolvedFocus.db.schemas.map((s) => ({
					name: s.name,
					tables: String(s.num_of_tables),
				})),
			});
			return {
				sections,
				header: {
					header: {
						title: resolvedFocus.db.name,
						subtitle: 'database',
						entityId: resolvedFocus.db.id,
						parentId: workspaceDataId,
					},
				},
			};
		}
		case 'schema': {
			const s = resolvedFocus.schema;
			sections.push(
				...baseCardsForEntity(`Schema ${s.name} in ${s.database_name}.`, [
					{ label: 'Schema', value: s.name },
					{ label: 'Database', value: s.database_name },
					{ label: 'Tables', value: String(s.num_of_tables) },
				]),
			);
			sections.push({
				kind: 'dataTable',
				id: 'child-tables',
				title: `Tables (${s.tables.length})`,
				columns: [
					{ key: 'name', label: 'Name' },
					{ key: 'columns', label: 'Columns' },
				],
				rows: s.tables.map((t) => ({
					name: t.name,
					columns: String(t.num_of_columns),
				})),
			});
			return {
				sections,
				header: {
					header: {
						title: s.name,
						subtitle: `Schema · ${resolvedFocus.db.name}`,
						entityId: s.id,
						parentId: resolvedFocus.db.id,
					},
				},
			};
		}
		case 'table': {
			const t = resolvedFocus.table;
			sections.push(
				...baseCardsForEntity(t.description, [
					{ label: 'Table', value: t.name },
					{ label: 'Schema', value: t.schema_name },
					{ label: 'Database', value: t.database_name },
					{ label: 'Columns', value: String(t.num_of_columns) },
				]),
			);
			sections.push({
				kind: 'dataTable',
				id: 'child-columns',
				title: `Columns (${t.columns.length})`,
				columns: [
					{ key: 'ordinal_position', label: '#' },
					{ key: 'name', label: 'Name' },
					{ key: 'data_type', label: 'Type' },
				],
				rows: t.columns.map((col) => ({
					ordinal_position: String(col.ordinal_position),
					name: col.name,
					data_type: col.data_type,
				})),
			});
			return {
				sections,
				header: {
					header: {
						title: t.name,
						subtitle: `Table · ${resolvedFocus.schema.name} · ${resolvedFocus.db.name}`,
						entityId: t.id,
						parentId: resolvedFocus.schema.id,
					},
				},
			};
		}
		case 'column': {
			const c = resolvedFocus.column;
			sections.push(
				...baseCardsForEntity(`Column ${c.name} in ${c.table_name}.`, [
					{ label: 'Column', value: c.name },
					{ label: 'Data type', value: c.data_type.trim() ? c.data_type : '—' },
					{ label: 'Table', value: c.table_name },
					{ label: 'Schema', value: c.schema_name },
					{ label: 'Database', value: c.database_name },
					{ label: 'Position', value: String(c.ordinal_position) },
				]),
			);
			return {
				sections,
				header: {
					header: {
						title: c.name,
						subtitle: `Column · ${c.schema_name} · ${c.table_name} · ${c.database_name}`,
						entityId: c.id,
						parentId: resolvedFocus.table.id,
					},
				},
			};
		}
	}
}
