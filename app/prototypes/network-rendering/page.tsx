import type { Metadata } from "next";
import { NetworkRenderingPrototype } from "./_components/network-rendering-prototype";

export const metadata: Metadata = {
  title: "Network rendering prototype",
  description: "Line geometry and corridor treatments for Subway in Motion.",
};

export default async function NetworkRenderingPrototypePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const value = (await searchParams).v;
  const parsed = Number.parseInt(
    Array.isArray(value) ? value[0] : (value ?? "1"),
    10,
  );
  const initialVariant = Number.isFinite(parsed)
    ? Math.min(3, Math.max(1, parsed)) - 1
    : 0;

  return <NetworkRenderingPrototype initialVariant={initialVariant} />;
}
