import { TransitExperience } from "./_components/transit-experience";
import type { SubwayManifest } from "@/lib/subway/types";
import manifestData from "@/public/data/subway/manifest.json";

export default function Home() {
  return <TransitExperience manifest={manifestData as SubwayManifest} />;
}
