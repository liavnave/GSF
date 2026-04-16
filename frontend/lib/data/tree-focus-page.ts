import type { SinglePageFormat } from '@/components/dataPage/SinglePageView';
import { ComposerSectionKind, DataModels, TreeFocusState } from '@/enums/datasources';
import type { Column, Database, Schema, Table } from '@/types/datasources';
import type { ComposerSection } from '@/types/composer-section';
import { isCatalogBranchLoadedForFocus } from '@/lib/data/catalog-branch-loaded';

export const WORKSPACE_ROOT_PARENT_ID = 'workspace-root';

export type TreeResolved =
	| { type: TreeFocusState.NONE }
	| { type: TreeFocusState.LOADING }
	| { type: DataModels.DB; db: Database }
	| { type: DataModels.SCHEMA; db: Database; schema: Schema }
	| { type: DataModels.TABLE; db: Database; schema: Schema; table: Table }
	| {
			type: DataModels.COLUMN;
			db: Database;
			schema: Schema;
			table: Table;
			column: Column;
	  };

function focusSegments(focusId: string): string[] {
	return focusId.split('|').filter((p) => p.length > 0);
}

function treePendingColumnFocus(focusId: string, databases: Database[]): TreeResolved {
	const parts = focusSegments(focusId);
	if (parts.length !== 4) return { type: TreeFocusState.NONE };
	const dbId = parts[0];
	if (!dbId || !databases.some((d) => d.id === dbId)) return { type: TreeFocusState.NONE };
	if (isCatalogBranchLoadedForFocus(databases, focusId)) return { type: TreeFocusState.NONE };
	return { type: TreeFocusState.LOADING };
}

export function resolveTreeNode(focusId: string | null, databases: Database[]): TreeResolved {
	if (!focusId) return { type: TreeFocusState.NONE };
	const parts = focusSegments(focusId);
	if (parts.length === 0) return { type: TreeFocusState.NONE };

	for (const db of databases) {
		if (parts[0] !== db.id) continue;
		if (parts.length === 1) return { type: DataModels.DB, db };

		for (const schema of db.schemas) {
			if (parts[1] !== schema.id) continue;
			if (parts.length === 2) return { type: DataModels.SCHEMA, db, schema };

			for (const table of schema.tables) {
				if (parts[2] !== table.id) continue;
				if (parts.length === 3) return { type: DataModels.TABLE, db, schema, table };

				for (const column of table.columns) {
					if (parts.length === 4 && parts[3] === column.column_name) {
						return { type: DataModels.COLUMN, db, schema, table, column };
					}
				}
			}
		}
	}

	if (parts.length === 4 && databases.some((d) => d.id === parts[0])) {
		return treePendingColumnFocus(focusId, databases);
	}

	return { type: TreeFocusState.NONE };
}

function baseCardsForEntity(
	description: string,
	items: { label: string; value: string }[],
): ComposerSection[] {
	return [
		{
			type: ComposerSectionKind.TEXT_CARD,
			id: 'description',
			title: 'Description',
			body: description,
		},
		{
			type: ComposerSectionKind.INFO_GRID,
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

	if (resolvedFocus.type === TreeFocusState.LOADING) {
		const sections: ComposerSection[] = [
			{
				type: ComposerSectionKind.LOADING_PANEL,
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

	if (resolvedFocus.type === TreeFocusState.NONE) {
		const sections: ComposerSection[] = [
			{
				type: ComposerSectionKind.TEXT_CARD,
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
				type: ComposerSectionKind.DATA_TABLE,
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

	switch (resolvedFocus.type) {
		case DataModels.DB: {
			sections.push(
				...baseCardsForEntity(
					`Warehouse connection ${resolvedFocus.db.name}. ${resolvedFocus.db.schemas.length} schema(s) available.`,
					[{ label: 'Schemas', value: String(resolvedFocus.db.schemas.length) }],
				),
			);
			sections.push({
				type: ComposerSectionKind.DATA_TABLE,
				id: 'child-schemas',
				title: `Schemas (${resolvedFocus.db.schemas.length})`,
				columns: [
					{ key: 'name', label: 'Name' },
					{ key: 'tables', label: 'Tables' },
				],
				rows: resolvedFocus.db.schemas.map((s) => ({
					name: s.schema_name,
					tables: String(s.tables_count),
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
		case DataModels.SCHEMA: {
			const s = resolvedFocus.schema;
			sections.push(
				...baseCardsForEntity(`Schema ${s.schema_name} in ${resolvedFocus.db.name}.`, [
					{ label: 'Schema', value: s.schema_name },
					{ label: 'Database', value: resolvedFocus.db.name },
					{ label: 'Tables', value: String(s.tables_count) },
				]),
			);
			sections.push({
				type: ComposerSectionKind.DATA_TABLE,
				id: 'child-tables',
				title: `Tables (${s.tables.length})`,
				columns: [
					{ key: 'name', label: 'Name' },
					{ key: 'columns', label: 'Columns' },
				],
				rows: s.tables.map((t) => ({
					name: t.name,
					columns: String(t.columns_count),
				})),
			});
			return {
				sections,
				header: {
					header: {
						title: s.schema_name,
						subtitle: `Schema · ${resolvedFocus.db.name}`,
						entityId: s.id,
						parentId: resolvedFocus.db.id,
					},
				},
			};
		}
		case DataModels.TABLE: {
			const t = resolvedFocus.table;
			sections.push(
				...baseCardsForEntity('', [
					{ label: 'Table', value: t.name },
					{ label: 'Schema', value: t.schema_name },
					{ label: 'Database', value: t.db_name },
					{ label: 'Columns', value: String(t.columns_count) },
				]),
			);
			sections.push({
				type: ComposerSectionKind.DATA_TABLE,
				id: 'child-columns',
				title: `Columns (${t.columns.length})`,
				columns: [
					{ key: 'ordinal_position', label: '#' },
					{ key: 'name', label: 'Name' },
					{ key: 'data_type', label: 'Type' },
				],
				rows: t.columns.map((col) => ({
					ordinal_position: String(col.ordinal_position),
					name: col.column_name,
					data_type: col.data_type,
				})),
			});
			return {
				sections,
				header: {
					header: {
						title: t.name,
						subtitle: `Table · ${resolvedFocus.schema.schema_name} · ${resolvedFocus.db.name}`,
						entityId: t.id,
						parentId: resolvedFocus.schema.id,
					},
				},
			};
		}
		case DataModels.COLUMN: {
			const c = resolvedFocus.column;
			sections.push(
				...baseCardsForEntity(`Column ${c.column_name} in ${c.table_name}.`, [
					{ label: 'Column', value: c.column_name },
					{ label: 'Data type', value: c.data_type.trim() ? c.data_type : '—' },
					{ label: 'Table', value: c.table_name },
					{ label: 'Schema', value: c.schema_name },
					{ label: 'Database', value: c.db_name },
					{ label: 'Position', value: String(c.ordinal_position) },
				]),
			);
			return {
				sections,
				header: {
					header: {
						title: c.column_name,
						subtitle: `Column · ${c.schema_name} · ${c.table_name} · ${c.db_name}`,
						entityId: c.column_name,
						parentId: resolvedFocus.table.id,
					},
				},
			};
		}
	}
}
