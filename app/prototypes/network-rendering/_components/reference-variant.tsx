import { RenderingStudy, type StudyVariantProps } from "./rendering-study";

export function ReferenceVariant(props: StudyVariantProps) {
  return (
    <RenderingStudy
      {...props}
      mode="reference"
      eyebrow="Current treatment"
      title="Reference"
      description="Simplified GTFS geometry, painted in the order it arrives from the feed."
      geometryLabel="11,890 points"
      overlapLabel="Feed order"
    />
  );
}
