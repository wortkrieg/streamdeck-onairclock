// Single home of hardware-dependent constants, confirmed on a Stream Deck MK.2 with
// Stream Deck 7.6.1 on 2026-11-11. See docs/superpowers/notes/2026-11-spike-findings.md.
export type DataUriFormat = "base64" | "utf8" | "uri";
export type GlowTechnique = "radialGradient" | "stackedCircles";

export const DATA_URI_FORMAT: DataUriFormat = "base64";
export const GLOW_TECHNIQUE: GlowTechnique = "radialGradient";
export const TEXT_SUPPORTED: boolean = true;
export const FAST_FPS: number = 10;
