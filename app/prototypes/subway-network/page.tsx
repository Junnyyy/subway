import type { Metadata } from "next";
import { BoroughsVariant } from "./_components/boroughs-variant";

export const metadata: Metadata = {
  title: "Subway network prototype",
  description: "Visual directions for an animated New York subway map.",
};

export default function SubwayNetworkPrototypePage() {
  return <BoroughsVariant />;
}
