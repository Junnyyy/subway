const MOBILE_WIDTH = 640;
const MOBILE_PIXEL_RATIO_CAP = 3;
const DESKTOP_PIXEL_RATIO_CAP = 2;
const MOBILE_PIXEL_BUDGET = 2_500_000;

export function canvasPixelRatio(
  width: number,
  height: number,
  devicePixelRatio: number,
) {
  const nativeRatio = Math.max(1, devicePixelRatio || 1);
  if (width >= MOBILE_WIDTH) {
    return Math.min(nativeRatio, DESKTOP_PIXEL_RATIO_CAP);
  }

  const budgetRatio = Math.sqrt(
    MOBILE_PIXEL_BUDGET / Math.max(1, width * height),
  );
  return Math.max(
    1,
    Math.min(nativeRatio, MOBILE_PIXEL_RATIO_CAP, budgetRatio),
  );
}
