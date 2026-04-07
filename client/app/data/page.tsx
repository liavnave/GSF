import type { Metadata } from "next";
import { Suspense } from "react";
import { DataWorkspaceView } from "@/components/dataPage";
import { datasources } from "@/api/datasources";

export const metadata: Metadata = {
  title: "Data",
};

export default async function DataPage() {
  const res = await datasources.getDBs({});
  const databases = res.error === true ? [] : res.data;
  const error = res.error === true ? (res.message ?? null) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
        <DataWorkspaceView databases={databases} loadError={error} />
    </div>
  );
}
