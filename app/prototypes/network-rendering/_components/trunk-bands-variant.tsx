import { RenderingStudy, type StudyVariantProps } from "./rendering-study";

export function TrunkBandsVariant(props: StudyVariantProps) {
  return (
    <RenderingStudy
      {...props}
      mode="bands"
      eyebrow="Cohesive corridors"
      title="Trunk bands"
      description="Detailed geometry grouped by color family. Longer trunk systems keep visual continuity through crossings."
      geometryLabel="22,597 points"
      overlapLabel="Longest trunk"
    />
  );
}
