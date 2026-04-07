import type { SinglePageFormat } from "@/components/dataPage/SinglePageView";
import type {
  ColumnField,
  Column,
  Database,
  Schema,
  Table,
} from "@/types/datasources";
import type { ComposerSection } from "@/types/composer-section";

export const WORKSPACE_ROOT_PARENT_ID = "mock-workspace-root";

export type TreeResolved =
  | { kind: "none" }
  | { kind: "db"; db: Database }
  | { kind: "schema"; db: Database; schema: Schema }
  | { kind: "table"; db: Database; schema: Schema; table: Table }
  | {
      kind: "column";
      db: Database;
      schema: Schema;
      table: Table;
      column: Column;
    }
  | {
      kind: "fill";
      db: Database;
      schema: Schema;
      table: Table;
      column: Column;
      fill: ColumnField;
    };

function inFills(
  db: Database,
  schema: Schema,
  table: Table,
  column: Column,
  focusId: string,
): TreeResolved | null {
  for (const fill of column.fills ?? []) {
    if (fill.id === focusId) {
      return { kind: "fill", db, schema, table, column, fill };
    }
  }
  return null;
}

function inColumns(
  db: Database,
  schema: Schema,
  table: Table,
  focusId: string,
): TreeResolved | null {
  for (const column of table.columns) {
    if (column.id === focusId) {
      return { kind: "column", db, schema, table, column };
    }
    const f = inFills(db, schema, table, column, focusId);
    if (f) return f;
  }
  return null;
}

function inTables(
  db: Database,
  schema: Schema,
  focusId: string,
): TreeResolved | null {
  for (const table of schema.tables) {
    if (table.id === focusId) {
      return { kind: "table", db, schema, table };
    }
    const c = inColumns(db, schema, table, focusId);
    if (c) return c;
  }
  return null;
}

function inSchemas(db: Database, focusId: string): TreeResolved | null {
  for (const schema of db.schemas) {
    if (schema.id === focusId) {
      return { kind: "schema", db, schema };
    }
    const t = inTables(db, schema, focusId);
    if (t) return t;
  }
  return null;
}

/** Обход дерева БД → схемы → таблицы → колонки → fills (рекурсивные вспомогательные функции). */
export function resolveTreeNode(
  focusId: string | null,
  databases: Database[],
): TreeResolved {
  if (!focusId) return { kind: "none" };
  for (const db of databases) {
    if (db.id === focusId) return { kind: "db", db };
    const s = inSchemas(db, focusId);
    if (s) return s;
  }
  return { kind: "none" };
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function baseCardsForEntity(
  description: string,
  items: { label: string; value: string }[],
): ComposerSection[] {
  return [
    {
      kind: "textCard",
      id: "description",
      title: "Description",
      body: description,
    },
    {
      kind: "infoGrid",
      id: "information",
      title: "Information",
      items,
    },
  ];
}

/**
 * Секции по узлу дерева: без focus — пустой массив; DB → schemas; schema → tables;
 * table → колонки; column → дочерние fills; fill → карточка поля и список соседей.
 */
export function buildTreeFocusPageFormat(
  focusId: string | null,
  databases: Database[],
  workspaceDataId: string,
): SinglePageFormat {
  const r = resolveTreeNode(focusId, databases);

  if (r.kind === "none") {
    return {
      sections: [],
      header: {
        header: {
          title: "All Data",
          subtitle:
            "Select a database, schema, table, column, or field in the tree.",
          entityId: workspaceDataId,
          parentId: WORKSPACE_ROOT_PARENT_ID,
        },
      },
    };
  }

  const sections: ComposerSection[] = [];

  switch (r.kind) {
    case "db": {
      sections.push(
        ...baseCardsForEntity(
          `Warehouse connection ${r.db.name} (${r.db.connector_type}). ${r.db.schemas.length} schema(s) available.`,
          [
            { label: "Connector", value: r.db.connector_type },
            { label: "Added", value: fmtDate(r.db.added) },
            { label: "Last pulled", value: fmtDate(r.db.pulled) },
            { label: "Schemas", value: String(r.db.schemas.length) },
            {
              label: "Owner",
              value: r.db.owner_id ?? "—",
            },
          ],
        ),
      );
      sections.push({
        kind: "dataTable",
        id: "child-schemas",
        title: `Schemas (${r.db.schemas.length})`,
        columns: [
          { key: "name", label: "Name" },
          { key: "description", label: "Description" },
          { key: "tables", label: "Tables" },
        ],
        rows: r.db.schemas.map((s) => ({
          name: s.name,
          description: s.description ?? "—",
          tables: String(s.num_of_tables),
        })),
      });
      return {
        sections,
        header: {
          header: {
            title: r.db.name,
            subtitle: `${r.db.connector_type} · database`,
            entityId: r.db.id,
            parentId: workspaceDataId,
          },
        },
      };
    }
    case "schema": {
      const s = r.schema;
      sections.push(
        ...baseCardsForEntity(
          s.description ?? `Schema ${s.name} in ${r.db.name}.`,
          [
            { label: "Schema", value: s.name },
            { label: "Added", value: fmtDate(s.added) },
            { label: "Tables", value: String(s.num_of_tables) },
            { label: "Database", value: r.db.name },
          ],
        ),
      );
      sections.push({
        kind: "dataTable",
        id: "child-tables",
        title: `Tables (${s.tables.length})`,
        columns: [
          { key: "name", label: "Name" },
          { key: "type", label: "Type" },
          { key: "columns", label: "Columns" },
          { key: "queries", label: "Queries" },
        ],
        rows: s.tables.map((t) => ({
          name: t.name,
          type: t.type,
          columns: String(t.num_of_columns),
          queries: String(t.num_of_queries),
        })),
      });
      return {
        sections,
        header: {
          header: {
            title: s.name,
            subtitle: `Schema · ${r.db.name}`,
            entityId: s.id,
            parentId: r.db.id,
          },
        },
      };
    }
    case "table": {
      const t = r.table;
      sections.push(
        ...baseCardsForEntity(
          t.description,
          [
            { label: "Table", value: t.name },
            { label: "Schema", value: r.schema.name },
            { label: "Database", value: r.db.name },
            { label: "Last queried", value: fmtDate(t.last_queried) },
            { label: "Columns", value: String(t.num_of_columns) },
          ],
        ),
      );
      sections.push({
        kind: "dataTable",
        id: "child-columns",
        title: `Columns (${t.columns.length})`,
        columns: [
          { key: "name", label: "Name" },
          { key: "data_type", label: "Type" },
          { key: "nullable", label: "Nullable" },
          { key: "usage", label: "Usage" },
        ],
        rows: t.columns.map((col) => ({
          name: col.name,
          data_type: col.data_type,
          nullable: col.nullable ? "Yes" : "No",
          usage: col.usage,
        })),
      });
      return {
        sections,
        header: {
          header: {
            title: t.name,
            subtitle: `Table · ${r.schema.name} · ${r.db.name}`,
            entityId: t.id,
            parentId: r.schema.id,
          },
        },
      };
    }
    case "column": {
      const c = r.column;
      const fills = c.fills ?? [];
      sections.push(
        ...baseCardsForEntity(
          c.description,
          [
            { label: "Column", value: c.name },
            { label: "Data type", value: c.data_type },
            { label: "Table", value: r.table.name },
            { label: "Schema", value: r.schema.name },
            { label: "Nullable", value: c.nullable ? "Yes" : "No" },
            { label: "Fields", value: String(fills.length) },
          ],
        ),
      );
      sections.push({
        kind: "dataTable",
        id: "child-fills",
        title: `Fields (${fills.length})`,
        columns: [
          { key: "name", label: "Name" },
          { key: "description", label: "Description" },
        ],
        rows: fills.map((f) => ({
          name: f.name,
          description: f.description,
        })),
      });
      return {
        sections,
        header: {
          header: {
            title: c.name,
            subtitle: `Column · ${r.table.name}`,
            entityId: c.id,
            parentId: r.table.id,
          },
        },
      };
    }
    case "fill": {
      const { fill: f, column: c, table: t } = r;
      const siblings = c.fills ?? [];
      sections.push(
        ...baseCardsForEntity(
          f.description,
          [
            { label: "Field", value: f.name },
            { label: "Column", value: c.name },
            { label: "Table", value: t.name },
            { label: "Schema", value: r.schema.name },
            { label: "Database", value: r.db.name },
          ],
        ),
      );
      sections.push({
        kind: "dataTable",
        id: "sibling-fills",
        title: `Fields in column (${siblings.length})`,
        columns: [
          { key: "name", label: "Name" },
          { key: "description", label: "Description" },
          { key: "selected", label: "Selected" },
        ],
        rows: siblings.map((x) => ({
          name: x.name,
          description: x.description,
          selected: x.id === f.id ? "Yes" : "No",
        })),
      });
      return {
        sections,
        header: {
          header: {
            title: f.name,
            subtitle: `Field · ${c.name}`,
            entityId: f.id,
            parentId: c.id,
          },
        },
      };
    }
  }
}
