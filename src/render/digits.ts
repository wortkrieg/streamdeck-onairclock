import { r2 } from "./geometry";

// Monoline glyphs in a 10x16 unit box (ported from the v2 mockup).
export const GLYPHS: Readonly<Record<string, string>> = {
	"0": "M5 0A5 5 0 0 1 10 5V11A5 5 0 0 1 0 11V5A5 5 0 0 1 5 0Z",
	"1": "M2 3.4L6.2 0V16",
	"2": "M0.4 4.6A4.8 4.6 0 1 1 8.4 8L0 16H10",
	"3": "M0.6 0H9.4L4.3 6.2A4.9 4.9 0 1 1 0.3 13.6",
	"4": "M7.4 16V0L0 11.2H10",
	"5": "M9.4 0H1.6L1 6.8A5 5 0 1 1 0.3 14",
	"6": "M7.6 0L0.9 8.2M10 11A5 5 0 1 1 0 11A5 5 0 1 1 10 11Z",
	"7": "M0 0H10L3.6 16",
	"8": "M5 7.4A3.7 3.7 0 1 1 5 0A3.7 3.7 0 1 1 5 7.4ZM5 7.4A4.3 4.3 0 1 0 5 16A4.3 4.3 0 1 0 5 7.4Z",
	"9": "M10 5A5 5 0 1 1 0 5A5 5 0 1 1 10 5ZM9.1 7.8L2.4 16",
	"-": "M1 8H7",
	"+": "M1 8H9M5 4V12",
};

// Column widths in units; glyphs default to 10. ":" is drawn as two dots, not a path.
const WIDTHS: Readonly<Record<string, number>> = {
	":": 4,
	"-": 8,
	"+": 10,
	" ": 4,
};
const GAP = 3.4;
const ROLL_DISTANCE = 9;

export interface DigitOptions {
	cx: number;
	cy: number;
	height: number;
	stroke: number;
	color: string;
	/** Previous text (same positions); changed glyphs roll while progress < 1. */
	prev?: string;
	/** Roll progress 0..1. */
	progress?: number;
	colonOpacity?: number;
}

export const easeOutCubic = (k: number): number =>
	1 - (1 - Math.min(1, Math.max(0, k))) ** 3;

// Unknown characters (no glyph, no width entry, not ":") are skipped entirely: they
// draw nothing and take up no width.
function isKnown(ch: string): boolean {
	return ch === ":" || ch === " " || ch in GLYPHS;
}

/** Width of `text` in glyph units (unknown characters take no space). */
export function textUnits(text: string): number {
	const known = [...text].filter(isKnown);
	return known.reduce((a, c) => a + (WIDTHS[c] ?? 10) + GAP, -GAP);
}

/**
 * Largest digit height up to `maxHeight` at which `text` drawn with `stroke` stays
 * within `maxWidth`. Long strings ("+00:12", "11-11-26") shrink, short ones keep
 * `maxHeight`.
 */
export function fitHeight(
	text: string,
	maxHeight: number,
	maxWidth: number,
	stroke: number,
): number {
	const units = textUnits(text);
	if (units <= 0) return maxHeight;
	return Math.min(maxHeight, ((maxWidth - stroke) * 16) / units);
}

export function renderDigits(text: string, o: DigitOptions): string {
	const sc = o.height / 16;
	const swU = o.stroke / sc;
	const k = o.progress ?? 1;
	const chars = [...text];
	const widthOf = (c: string): number => WIDTHS[c] ?? 10;
	const known = chars.map((c, i) => ({ c, i })).filter(({ c }) => isKnown(c));
	const total = known.reduce((a, { c }) => a + widthOf(c) + GAP, -GAP);
	let x = -total / 2;
	let out = "";
	const prevChars = o.prev === undefined ? undefined : [...o.prev];
	for (const { c, i } of known) {
		const prev = prevChars?.[i];
		if (c === ":") {
			const r = r2(swU * 0.62);
			out += `<g opacity="${o.colonOpacity ?? 1}" stroke="none" fill="${o.color}"><circle cx="${r2(x + 2)}" cy="4.6" r="${r}"/><circle cx="${r2(x + 2)}" cy="11.4" r="${r}"/></g>`;
		} else if (c in GLYPHS) {
			if (prev !== undefined && prev !== c && k < 1 && prev in GLYPHS) {
				const e = easeOutCubic(k);
				out += `<path d="${GLYPHS[prev]}" transform="translate(${r2(x)} ${r2(-e * ROLL_DISTANCE)})" opacity="${r2(1 - e)}"/>`;
				out += `<path d="${GLYPHS[c]}" transform="translate(${r2(x)} ${r2((1 - e) * ROLL_DISTANCE)})" opacity="${r2(e)}"/>`;
			} else {
				out += `<path d="${GLYPHS[c]}" transform="translate(${r2(x)} 0)"/>`;
			}
		}
		x += widthOf(c) + GAP;
	}
	return `<g transform="translate(${r2(o.cx)} ${r2(o.cy)}) scale(${Math.round(sc * 1000) / 1000}) translate(0 -8)" fill="none" stroke="${o.color}" stroke-width="${r2(swU)}" stroke-linecap="round" stroke-linejoin="round">${out}</g>`;
}
