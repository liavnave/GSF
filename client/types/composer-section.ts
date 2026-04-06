export type ComposerTextCardSection = {
  kind: "textCard";
  id: string;
  title: string;
  body: string;
};

export type ComposerInfoGridSection = {
  kind: "infoGrid";
  id: string;
  title: string;
  items: { label: string; value: string }[];
};

export type ComposerDataTableSection = {
  kind: "dataTable";
  id: string;
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string>[];
};

export type ComposerSection =
  | ComposerTextCardSection
  | ComposerInfoGridSection
  | ComposerDataTableSection;

export function isComposerSection(x: unknown): x is ComposerSection {
  return (
    x !== null &&
    typeof x === "object" &&
    "kind" in x &&
    typeof (x as ComposerSection).kind === "string"
  );
}
