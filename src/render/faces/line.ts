// Line: continuous arc with a glowing head over a thin background ring.
// Time large, seconds small below. No date. Geometry from the v2 mockup.
import type { FaceModel } from "../../core/clock-model";
import { arcPath, polar, r2 } from "../geometry";
import {
	type AnimState,
	atZero,
	dimRing,
	type FaceStyle,
	head,
	label,
	MIN_FRACTION,
	mainLine,
	pmDot,
	pmPosition,
	ringFraction,
	subLine,
	wiping,
} from "./shared";

const R = 64;
const WIDTH = 4;

function arc(f0: number, f1: number, color: string, opacity = 1): string {
	const d = arcPath(R, f0, f1);
	const op = opacity < 1 ? ` opacity="${r2(opacity)}"` : "";
	return d
		? `<path d="${d}" fill="none" stroke="${color}" stroke-width="${WIDTH}" stroke-linecap="round"${op}/>`
		: "";
}

export function renderLine(m: FaceModel, s: FaceStyle, a: AnimState): string {
	const c = s.active;
	const t = s.time;
	let out = dimRing(R, 1.5, s.inactive);
	// Ring reset: the full ring of the past minute fades out.
	if (wiping(m, a)) out += arc(0, 1, c, 1 - a.wipe);
	const frac = ringFraction(m, a);
	out += arc(0, frac, c);
	// The head marks the moving end; a full countdown ring at zero has none.
	if (frac > MIN_FRACTION && !atZero(m)) {
		const [x, y] = polar(R, frac);
		out += head(x, y, 4.6 + 1.2 * a.glow, c);
	}

	if (m.label) out += label(m.label, 38, 19, t, 80);
	const main = {
		cy: m.sub ? 68 : 72,
		height: 28,
		stroke: 4.2,
		maxWidth: 106,
	};
	out += mainLine(m, a, t, main);
	out += subLine(m, a, t, { cy: 101, height: 17, stroke: 2.9 });
	if (m.pm) out += pmDot(...pmPosition(m.main, main), t);
	return out;
}
