// Types and drawing parts shared by the five faces. Geometry is 144x144, centre 72,72.
import type { FaceModel } from "../../core/clock-model";
import { GLOW_TECHNIQUE, TEXT_SUPPORTED } from "../../hardware";
import { easeOutCubic, renderDigits } from "../digits";
import { polar, r2 } from "../geometry";

export interface FaceStyle {
	active: string;
	inactive: string;
	background: string;
}

/** Animation progress for one frame. Task 8 computes it; STATIC_ANIM is the neutral frame. */
export interface AnimState {
	/** Roll progress 0..1 of the main digits (linear; the digits ease themselves). */
	roll: number;
	/** Ring reset progress 0..1 after the full minute (linear, eased here). Clock mode only. */
	wipe: number;
	/** Afterglow intensity 1..0 of the current second / ring head. */
	glow: number;
	colonOpacity: number;
	/** Opacity of the whole face (countdown warning). */
	pulse: number;
	/** Countdown ring visible (blinks in overtime, hold and flash). */
	ringOn: boolean;
	/** Full-key flash (countdown reached zero). */
	flash: boolean;
	/** Roll progress 0..1 of the seconds digits; omitted = no roll. */
	subRoll?: number;
}

export const STATIC_ANIM: AnimState = Object.freeze({
	roll: 1,
	wipe: 1,
	glow: 0,
	colonOpacity: 1,
	pulse: 1,
	ringOn: true,
	flash: false,
});

export type FaceRenderer = (m: FaceModel, s: FaceStyle, a: AnimState) => string;

export const FLASH_OPACITY = 0.22;
/** Below this the ring/line is not drawn (avoids a dot-sized arc at the minute). */
export const MIN_FRACTION = 0.002;

/** Countdown at zero (overtime, hold, flash): the ring is full and blinks via ringOn. */
export function atZero(m: FaceModel): boolean {
	return m.mode === "countdown" && m.countdown?.phase !== "running";
}

/** Share of the ring to draw: clock seconds, countdown remainder, or full/empty at zero. */
export function ringFraction(m: FaceModel, a: AnimState): number {
	if (atZero(m)) return a.ringOn ? 1 : 0;
	return m.fraction;
}

/** Active dots 0-60, same rules as ringFraction. */
export function ringSteps(m: FaceModel, a: AnimState): number {
	if (atZero(m)) return a.ringOn ? 60 : 0;
	return m.step;
}

/** The ring reset runs only in clock mode while wipe < 1. */
export function wiping(m: FaceModel, a: AnimState): boolean {
	return m.mode === "clock" && a.wipe < 1;
}

export function dot(
	x: number,
	y: number,
	r: number,
	color: string,
	opacity = 1,
): string {
	const op = opacity < 1 ? ` opacity="${r2(opacity)}"` : "";
	return `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" fill="${color}"${op}/>`;
}

export function dimRing(r: number, width: number, color: string): string {
	return `<circle cx="72" cy="72" r="${r}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
}

export const GLOW_ID = "glow";

/** Gradient for the radialGradient technique; renderFace adds it once when used. */
export function glowDefs(color: string): string {
	return `<defs><radialGradient id="${GLOW_ID}"><stop offset="0" stop-color="${color}" stop-opacity=".55"/><stop offset=".45" stop-color="${color}" stop-opacity=".18"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>`;
}

/** Soft halo with outer radius `outer`, scaled by `opacity` (0..1). */
export function glow(
	x: number,
	y: number,
	outer: number,
	color: string,
	opacity = 1,
): string {
	if (opacity <= 0 || outer <= 0) return "";
	if (GLOW_TECHNIQUE === "radialGradient") {
		const op = opacity < 1 ? ` opacity="${r2(opacity)}"` : "";
		return `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(outer)}" fill="url(#${GLOW_ID})"${op}/>`;
	}
	// Three translucent discs (outer x1, x0.69, x0.47 like 3.2/2.2/1.5 of a head).
	const layers: ReadonlyArray<[number, number]> = [
		[1, 0.12],
		[2.2 / 3.2, 0.2],
		[1.5 / 3.2, 0.3],
	];
	return layers
		.map(
			([f, o]) =>
				`<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(outer * f)}" fill="${color}" fill-opacity="${r2(o * opacity)}"/>`,
		)
		.join("");
}

/** Ring head: halo (3.2x) plus a solid core. */
export function head(x: number, y: number, rad: number, color: string): string {
	return glow(x, y, rad * 3.2, color) + dot(x, y, rad, color);
}

/** Small PM marker (V1 drew "*"). */
export function pmDot(x: number, y: number, color: string): string {
	return dot(x, y, 2, color);
}

export function escapeXml(s: string): string {
	return s.replace(
		/[&<>"']/g,
		(c) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				c
			] ?? c,
	);
}

/** Label text centred on cy (cap height ~0.7em). "" when the key cannot draw text. */
export function label(
	text: string,
	cy: number,
	size: number,
	color: string,
): string {
	if (!TEXT_SUPPORTED) return "";
	return `<text x="72" y="${r2(cy + size * 0.35)}" font-family="Barlow, Arial, sans-serif" font-weight="600" font-size="${size}" text-anchor="middle" fill="${color}">${escapeXml(text.toUpperCase())}</text>`;
}

/** "16:59" / "+00:05" -> ["16", "59"] / ["00", "05"]; the two-row faces draw the "+" separately. */
export function splitMain(main: string): [string, string] {
	const [a = "", b = ""] = main.replace("+", "").split(":");
	return [a, b];
}

export interface DigitBox {
	cx?: number;
	cy: number;
	height: number;
	stroke: number;
}

/** Main digits on one line, with roll and colon blink. */
export function mainLine(
	m: FaceModel,
	a: AnimState,
	color: string,
	box: DigitBox,
): string {
	return renderDigits(m.main, {
		...box,
		cx: box.cx ?? 72,
		color,
		prev: m.prevMain,
		progress: a.roll,
		colonOpacity: a.colonOpacity,
	});
}

/** Main digits on two lines (hours/minutes or countdown minutes/seconds). */
export function mainTwoLines(
	m: FaceModel,
	a: AnimState,
	color: string,
	top: DigitBox,
	bottom: DigitBox,
): string {
	const [hh, mm] = splitMain(m.main);
	const [ph, pm] = splitMain(m.prevMain);
	const line = (text: string, prev: string, box: DigitBox) =>
		renderDigits(text, {
			...box,
			cx: box.cx ?? 72,
			color,
			prev,
			progress: a.roll,
		});
	return (
		line(hh, ph, top) +
		line(mm, pm, bottom) +
		(m.main.startsWith("+") ? overtimeSign(hh, color, top) : "")
	);
}

// Digit glyph cell and gap in glyph units (see digits.ts); the "+" arms span +-4 units.
const GLYPH_W = 10;
const GLYPH_GAP = 3.4;
const SIGN_SIZE = 0.8;

/** Overtime "+" for the two-row faces: smaller, left of the top row, centred on it. */
function overtimeSign(row: string, color: string, top: DigitBox): string {
	const units = row.length * GLYPH_W + (row.length - 1) * GLYPH_GAP;
	const rowHalf = (units * top.height) / 16 / 2 + top.stroke / 2;
	const height = top.height * SIGN_SIZE;
	const stroke = top.stroke * 0.9;
	const signHalf = (4 * height) / 16 + stroke / 2;
	const gap = top.height * 0.12;
	return renderDigits("+", {
		cx: (top.cx ?? 72) - rowHalf - gap - signHalf,
		cy: top.cy,
		height,
		stroke,
		color,
	});
}

/** Seconds digits (only when the model has them). */
export function subLine(
	m: FaceModel,
	a: AnimState,
	color: string,
	box: DigitBox,
): string {
	if (m.sub === undefined) return "";
	return renderDigits(m.sub, {
		...box,
		cx: box.cx ?? 72,
		color,
		prev: m.prevSub,
		progress: a.subRoll ?? 1,
	});
}

const DOT_RING_R = 61;
const DOT_ON = 2.3;
const DOT_OFF = 1.45;

/**
 * 60-dot seconds ring (classic, modern): active dots, inactive dots, the ring reset
 * (dots from the wipe front to 12 o'clock stay lit and run out) and the afterglow.
 */
export function dotRing(m: FaceModel, s: FaceStyle, a: AnimState): string {
	const steps = ringSteps(m, a);
	const wipeFrom = wiping(m, a) ? Math.ceil(easeOutCubic(a.wipe) * 60) : 60;
	let out = "";
	for (let i = 0; i < 60; i++) {
		const [x, y] = polar(DOT_RING_R, i / 60);
		if (i < steps) out += dot(x, y, DOT_ON, s.active);
		else if (i >= wipeFrom) out += dot(x, y, DOT_ON, s.active, 0.9);
		else out += dot(x, y, DOT_OFF, s.inactive);
	}
	if (a.glow > 0 && m.step > 0) {
		const [x, y] = polar(DOT_RING_R, (m.step - 1) / 60);
		out += glow(x, y, 4 + 5 * a.glow, s.active, a.glow);
	}
	return out;
}
