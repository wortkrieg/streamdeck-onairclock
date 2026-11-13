import { formatMMSS } from "../core/format";
import { CLOCK_DEFAULTS } from "../core/settings";
import { renderDigits } from "./digits";
import { svgDocument } from "./svg";

export type AdjustDirection = "plus" | "minus";

/**
 * Countdown + or − key: the step in the countdown key's digits, and the sign where the
 * countdown key has its start triangle, so the keys line up in a row.
 */
export function renderAdjustKey(
	direction: AdjustDirection,
	stepSec: number,
	color: string,
): string {
	const digits = renderDigits(formatMMSS(stepSec), {
		cx: 72,
		cy: 60,
		height: 32,
		stroke: 4.2,
		color,
	});
	const d = direction === "plus" ? "M62 103H82M72 93V113" : "M62 103H82";
	const sign = `<path d="${d}" class="sign" fill="none" stroke="${color}" stroke-width="4.6" stroke-linecap="round"/>`;
	return svgDocument(digits + sign, CLOCK_DEFAULTS.colors.background);
}
