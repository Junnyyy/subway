import { RenderingStudy, type StudyVariantProps } from "./rendering-study";

export function SharedLanesVariant(props: StudyVariantProps) {
  return (
    <RenderingStudy
      {...props}
      mode="lanes"
      eyebrow="Equal shared corridors"
      title="Shared lanes"
      description="Detailed geometry separates parallel color families only where they share the same corridor."
      geometryLabel="22,597 points"
      overlapLabel="Parallel lanes"
    />
  );
}
