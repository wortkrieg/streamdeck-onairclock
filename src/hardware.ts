// Single home of hardware-dependent constants (determined by the hardware spike).
// STATUS: PROVISIONAL. Values are educated defaults, to be confirmed in the hardware
// session. See docs/superpowers/notes/2026-11-spike-findings.md.
export type DataUriFormat = "base64" | "utf8" | "uri";
export type GlowTechnique = "radialGradient" | "stackedCircles";

export const DATA_URI_FORMAT: DataUriFormat = "base64";
export const GLOW_TECHNIQUE: GlowTechnique = "stackedCircles";
export const TEXT_SUPPORTED: boolean = true;
export const FAST_FPS: number = 10;
