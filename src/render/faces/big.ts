// Big: hours and minutes as large as possible, stacked; second progress as a thin
// line at the bottom edge. For reading from a distance. Geometry from the v2 mockup.
import type { FaceModel } from "../../core/clock-model";
import { easeOutCubic } from "../digits";
import { r2 } from "../geometry";
import {
	type AnimState,
	type FaceStyle,
	MIN_FRACTION,
	mainTwoLines,
	pmDot,
	pmPosition,
	ringFraction,
	splitMain,
	wiping,
} from "./shared";

const X0 = 22;
const LEN = 100;
const Y = 131;

function bar(f0: number, f1: number, color: string): string {
	return `<line x1="${r2(X0 + LEN * f0)}" y1="${Y}" x2="${r2(X0 + LEN * f1)}" y2="${Y}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
}

export function renderBig(m: FaceModel, s: FaceStyle, a: AnimState): string {
	const c = s.active;
	const t = s.time;
	const top = { cy: 41, height: 44, stroke: 5.6 };
	let out = mainTwoLines(m, a, t, top, { cy: 95, height: 44, stroke: 5.6 });
	out += bar(0, 1, s.inactive);
	const frac = ringFraction(m, a);
	if (frac > MIN_FRACTION) out += bar(0, frac, c);
	if (wiping(m, a)) out += bar(easeOutCubic(a.wipe), 1, c);
	if (m.pm) out += pmDot(...pmPosition(splitMain(m.main)[0], top), t);
	return out;
}
