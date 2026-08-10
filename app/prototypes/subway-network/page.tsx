import type { Metadata } from "next";
import { SubwayPrototype } from "./_components/subway-prototype";

export const metadata: Metadata = {
  title: "Subway network prototype",
  description: "Visual directions for an animated New York subway map.",
};

export default async function SubwayNetworkPrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const value = (await searchParams).v;
  const parsed = Number.parseInt(Array.isArray(value) ? value[0] : (value ?? "1"), 10);
  const initialVariant = Number.isFinite(parsed)
    ? Math.min(3, Math.max(1, parsed)) - 1
    : 0;

  return <SubwayPrototype initialVariant={initialVariant} />;
}
