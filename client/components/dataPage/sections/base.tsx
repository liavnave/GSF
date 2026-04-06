import type { DataModels } from "@/common/enums";

/** Port from illumex `components/dataPage/sections/base.tsx`. */
export function getTitleFromDataModelType(type: DataModels): string {
  return String(type).toLowerCase().replace(/_/g, " ");
}
