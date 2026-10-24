/**
 * components/Logo.tsx
 *
 * The Habak logo rendered as a CSS mask, so it takes the current text color
 * (amber in the control-room theme) instead of its original colors.
 * Size it with width/height classes via `className` (aspect ratio is fixed).
 */

export function Logo({ className = "w-8" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block bg-current shrink-0 ${className}`}
      style={{
        aspectRatio: "232 / 300",
        WebkitMaskImage: "url(/habak-logo-mask.png)",
        maskImage: "url(/habak-logo-mask.png)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
