import type { SinglePageFormat } from "@/components/dataPage/SinglePageView";
import type { Database, NameId, SchemaColumn, SchemaEntity, SchemaTable } from "@/types/datasources";
import { ConnectionType, DataModels, Usage } from "@/enums/datasources";
import type { ComposerSection } from "@/types/composer-section";

/** В каждой схеме одна таблица с 5 колонками (как «5 columns per schema»). */
const TABLES_PER_SCHEMA = 1;
const COLUMNS_PER_TABLE = 5;

function ni(id: string, name: string): NameId {
  return { id, name };
}

function makeColumn(
  dbRef: NameId,
  schemaRef: NameId,
  tableRef: NameId,
  colIndex: number,
): SchemaColumn {
  const colId = `${tableRef.id}-col-${colIndex}`;
  const types = ["bigint", "varchar", "timestamp", "boolean", "double"] as const;
  return {
    id: colId,
    name: `col_${colIndex}`,
    data_type: types[(colIndex - 1) % types.length],
    description: `Column ${colIndex}`,
    last_queried: "2024-06-01T12:00:00.000Z",
    num_of_aliases: 0,
    num_of_attributes: 0,
    num_of_const_comparisons: 0,
    num_of_field_comparisons: 0,
    num_of_queries: 20 * colIndex,
    num_of_terms: 0,
    db: dbRef,
    schema: schemaRef,
    table: tableRef,
    label: DataModels.COLUMN,
    tags: [],
    type: DataModels.COLUMN,
    length: null,
    scale: null,
    default_value: null,
    nullable: colIndex > 1,
    owner_notes: null,
    syntax_example: null,
    usage: colIndex % 2 === 0 ? Usage.MEDIUM : Usage.LOW,
    num_of_usage: colIndex,
    related_terms: [],
    related_attributes: [],
  };
}

function makeTable(
  dbRef: NameId,
  schemaRef: NameId,
  tableIndex: number,
  numColumns: number,
): SchemaTable {
  const tableId = `${schemaRef.id}-tbl-${tableIndex}`;
  const tableRef = ni(tableId, `table_${tableIndex}`);
  const columns = Array.from({ length: numColumns }, (_, i) =>
    makeColumn(dbRef, schemaRef, tableRef, i + 1),
  );
  return {
    id: tableId,
    name: `table_${tableIndex}`,
    description: `Table ${tableIndex} in ${schemaRef.name}`,
    last_queried: "2024-06-01T12:00:00.000Z",
    num_of_columns: numColumns,
    num_of_queries: 100 * tableIndex,
    num_of_terms: 0,
    num_of_dup: 0,
    num_of_filters: 0,
    num_of_joins: 0,
    num_of_aggregations: 0,
    db: dbRef,
    schema: schemaRef,
    type: DataModels.TABLE,
    label: DataModels.TABLE,
    tags: [],
    columns,
    owner_id: null,
    owner_notes: null,
    last_modified: null,
    created_date: null,
    retention_time: null,
    row_count: 10_000 * tableIndex,
    size: null,
    related_terms: [],
    num_of_usage: 10 * tableIndex,
    usage: Usage.HIGH,
  };
}

function makeSchema(
  dbRef: NameId,
  schemaName: string,
  numTables: number,
  numColumnsPerTable: number,
): SchemaEntity {
  const slug = schemaName.replace(/\s+/g, "-").toLowerCase();
  const schemaId = `${dbRef.id}-schema-${slug}`;
  const schemaRef = ni(schemaId, schemaName);
  const tables = Array.from({ length: numTables }, (_, ti) =>
    makeTable(dbRef, schemaRef, ti + 1, numColumnsPerTable),
  );
  return {
    id: schemaId,
    added: "2024-01-10T08:00:00.000Z",
    description: `Schema ${schemaName}`,
    name: schemaName,
    tables,
    num_of_tables: tables.length,
    type: DataModels.SCHEMA,
    owner_id: null,
    tags: [],
  };
}

function makeDatabase(
  shortIndex: number,
  name: string,
  connector: ConnectionType,
  schemaNames: string[],
): Database {
  const dbId = `mock-db-${String(shortIndex).padStart(3, "0")}`;
  const dbRef = ni(dbId, name);
  const schemas = schemaNames.map((schemaName) =>
    makeSchema(dbRef, schemaName, TABLES_PER_SCHEMA, COLUMNS_PER_TABLE),
  );
  return {
    id: dbId,
    name,
    added: "2024-01-01T00:00:00.000Z",
    pulled: "2024-06-01T09:00:00.000Z",
    connector_type: connector,
    schemas,
    type: DataModels.DB,
    owner_id: null,
  };
}

/** 3 БД: 3 схемы / 2 схемы / 1 схема; в каждой схеме 5 таблиц × 5 колонок. */
export const mockDatabases: Database[] = [
  makeDatabase(1, "Northwind DW", ConnectionType.SNOWFLAKE, [
    "raw",
    "curated",
    "mart",
  ]),
  makeDatabase(2, "Sales Lake", ConnectionType.BIG_QUERY, ["bronze", "silver"]),
  makeDatabase(3, "Ops OLTP", ConnectionType.REDSHIFT, ["public"]),
];

export const mockDatabase = mockDatabases[0];

/** Какая БД показывается в теле страницы по id сущности (БД / схема / таблица / колонка). */
export function resolvePageDatabase(
  entityId: string,
  databases: Database[],
): Database {
  for (const db of databases) {
    if (db.id === entityId) return db;
    for (const s of db.schemas) {
      if (s.id === entityId) return db;
      for (const t of s.tables) {
        if (t.id === entityId) return db;
        for (const c of t.columns) {
          if (c.id === entityId) return db;
        }
      }
    }
  }
  return databases[0] ?? mockDatabase;
}

export function buildSinglePageFormatForDatabase(db: Database): SinglePageFormat {
  return {
    sections: [
      {
        id: "database",
        heading: "Database",
        entity: db,
      },
      ...db.schemas.map((schema) => ({
        id: `schema-${schema.id}`,
        heading: `Schema: ${schema.name}`,
        entity: schema,
      })),
    ],
    header: {
      header: {
        subtitle: `${db.connector_type} · ${db.schemas.length} schema(s)`,
      },
    },
  };
}

export type TreeResolved =
  | { kind: "none" }
  | { kind: "db"; db: Database }
  | { kind: "schema"; db: Database; schema: SchemaEntity }
  | { kind: "table"; db: Database; schema: SchemaEntity; table: SchemaTable }
  | {
      kind: "column";
      db: Database;
      schema: SchemaEntity;
      table: SchemaTable;
      column: SchemaColumn;
    };

export function resolveTreeNode(
  focusId: string | null,
  databases: Database[],
): TreeResolved {
  if (!focusId) return { kind: "none" };
  for (const db of databases) {
    if (db.id === focusId) return { kind: "db", db };
    for (const schema of db.schemas) {
      if (schema.id === focusId) return { kind: "schema", db, schema };
      for (const table of schema.tables) {
        if (table.id === focusId) return { kind: "table", db, schema, table };
        for (const col of table.columns) {
          if (col.id === focusId) {
            return { kind: "column", db, schema, table, column: col };
          }
        }
      }
    }
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
 * Секции по узлу дерева: без focus — пустой массив; DB → схемы внизу, schema → таблицы, table → колонки, column → все поля таблицы.
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
          subtitle: "Select a database, schema, table, or column in the tree.",
          entityId: workspaceDataId,
          parentId: "mock-workspace-root",
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
      sections.push(
        ...baseCardsForEntity(
          r.schema.description ?? `Schema ${r.schema.name} in ${r.db.name}.`,
          [
            { label: "Schema", value: r.schema.name },
            { label: "Added", value: fmtDate(r.schema.added) },
            { label: "Tables", value: String(r.schema.num_of_tables) },
            { label: "Database", value: r.db.name },
          ],
        ),
      );
      sections.push({
        kind: "dataTable",
        id: "child-tables",
        title: `Tables (${r.schema.tables.length})`,
        columns: [
          { key: "name", label: "Name" },
          { key: "type", label: "Type" },
          { key: "columns", label: "Columns" },
          { key: "queries", label: "Queries" },
        ],
        rows: r.schema.tables.map((t) => ({
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
            title: r.schema.name,
            subtitle: `Schema · ${r.db.name}`,
            entityId: r.schema.id,
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
      const { column: c, table: t } = r;
      sections.push(
        ...baseCardsForEntity(
          c.description,
          [
            { label: "Column", value: c.name },
            { label: "Data type", value: c.data_type },
            { label: "Table", value: t.name },
            { label: "Schema", value: r.schema.name },
            { label: "Nullable", value: c.nullable ? "Yes" : "No" },
            { label: "Last queried", value: c.last_queried ? fmtDate(c.last_queried) : "—" },
          ],
        ),
      );
      sections.push({
        kind: "dataTable",
        id: "table-fields",
        title: `Fields (${t.columns.length})`,
        columns: [
          { key: "name", label: "Name" },
          { key: "data_type", label: "Type" },
          { key: "nullable", label: "Nullable" },
          { key: "calculated", label: "Calculated" },
          { key: "selected", label: "Selected" },
        ],
        rows: t.columns.map((col) => ({
          name: col.name,
          data_type: col.data_type,
          nullable: col.nullable ? "Yes" : "No",
          calculated: "No",
          selected: col.id === c.id ? "Yes" : "No",
        })),
      });
      return {
        sections,
        header: {
          header: {
            title: c.name,
            subtitle: `Column · ${t.name}`,
            entityId: c.id,
            parentId: t.id,
          },
        },
      };
    }
  }
}

/** Статические пропсы для демо: первая БД. */
export const defaultSinglePageViewProps = {
  dataId: mockDatabase.id,
  parentId: "mock-workspace-root",
  title: mockDatabase.name,
} as const;

/** Стартовый формат без выбора в дереве (секции пустые). */
export const mockSinglePageFormat: SinglePageFormat =
  buildTreeFocusPageFormat(null, mockDatabases, mockDatabase.id);
