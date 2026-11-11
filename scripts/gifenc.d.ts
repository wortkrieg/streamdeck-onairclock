// Minimal types for gifenc 1.x (the package ships none).
declare module "gifenc" {
	export type Palette = number[][];
	export type PaletteFormat = "rgb565" | "rgb444" | "rgba4444";

	export interface FrameOptions {
		palette?: Palette;
		delay?: number;
		repeat?: number;
		transparent?: boolean;
		transparentIndex?: number;
		dispose?: number;
		first?: boolean;
	}

	export interface Encoder {
		writeFrame(
			index: Uint8Array,
			width: number,
			height: number,
			options?: FrameOptions,
		): void;
		finish(): void;
		bytes(): Uint8Array;
	}

	export function GIFEncoder(options?: {
		auto?: boolean;
		initialCapacity?: number;
	}): Encoder;
	export function quantize(
		rgba: Uint8Array | Uint8ClampedArray,
		maxColors: number,
		options?: { format?: PaletteFormat },
	): Palette;
	export function applyPalette(
		rgba: Uint8Array | Uint8ClampedArray,
		palette: Palette,
		format?: PaletteFormat,
	): Uint8Array;
}
