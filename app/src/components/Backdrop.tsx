import { useMedia } from "../lib/hooks";
import DotGrid from "../vendor/DotGrid";
import LightRays from "../vendor/LightRays";

const DOT_PATTERN = {
  backgroundImage: "radial-gradient(circle, #2f2a3b 1.2px, transparent 1.6px)",
  backgroundSize: "20px 20px",
  maskImage: "radial-gradient(ellipse 70% 50% at 85% 62%, black 10%, transparent 70%)",
  WebkitMaskImage: "radial-gradient(ellipse 70% 50% at 85% 62%, black 10%, transparent 70%)",
};
const DOT_GRID_MASK = {
  maskImage: "radial-gradient(ellipse at 60% 45%, black 20%, transparent 70%)",
  WebkitMaskImage: "radial-gradient(ellipse at 60% 45%, black 20%, transparent 70%)",
};

/**
 * The z5.gg landing page's background. The animated light and dots only run on larger screens;
 * phones get a still version. The light is screen-blended so its faint edges never darken the page.
 */
export default function Backdrop() {
  const tablet = useMedia("(min-width: 768px)");
  const desktop = useMedia("(min-width: 1024px)");
  return (
    <div className="pointer-events-none absolute inset-0">
      {tablet ? (
        <LightRays
          raysOrigin="top-center"
          raysColor="#c9bfff"
          raysSpeed={0.6}
          lightSpread={0.7}
          rayLength={1.6}
          intensity={0.55}
          followMouse={false}
          cursorShadow={false}
          clickPulse={false}
          haze={0.2}
          className="absolute inset-0 mix-blend-screen"
        />
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 45% at 50% 0%, rgb(201 191 255 / 0.2), transparent 70%)" }} />
          <div className="absolute inset-x-0 top-0 h-[700px] opacity-70" style={DOT_PATTERN} />
        </>
      )}
      {desktop && (
        <div className="absolute inset-y-0 right-0 w-[52%]" style={DOT_GRID_MASK}>
          <DotGrid dotSize={3} gap={22} baseColor="#2a2633" activeColor="#b19eef" proximity={120} glow={0.4} clickShock={false} className="pointer-events-auto h-full w-full" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-page" />
    </div>
  );
}
