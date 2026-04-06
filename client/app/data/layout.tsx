import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data — single page (mock)",
};

export default function DataLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col p-4">{children}</div>
  );
}
