const WOMEN_SECTION_PATH = "M 600 130 H 960 V 550 H 772 V 390 H 600 Z";

export default function CustomPlanFloorZone({ opacity = 0.78 }: { opacity?: number }) {
  return (
    <path
      d={WOMEN_SECTION_PATH}
      fill="#f8dfe8"
      opacity={opacity}
      className="pointer-events-none"
      aria-hidden="true"
    />
  );
}
