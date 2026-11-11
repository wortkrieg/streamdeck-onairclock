// Comet: hairline ring with a light point and a fading tail. Hours and minutes large,
// stacked; seconds only on the ring. Geometry from the v2 mockup.
import type { FaceModel } from "../../core/clock-model";
import { arcPath, polar, r2 } from "../geometry";
import {
	type AnimState,
	atZero,
	dimRing,
	type FaceStyle,
	head,
	MIN_FRACTION,
	mainTwoLines,
	pmDot,
	pmPosition,
	ringFraction,
	splitMain,
} from "./shared";

const R = 64;
const TAIL = 0.22;
const SEGMENTS = 16;

function tail(frac: number, color: string): string {
	const len = Math.min(TAIL, frac);
	let out = "";
	for (let j = 0; j < SEGMENTS; j++) {
		const d = arcPath(
			R,
			Math.max(0, frac - (len * (j + 1)) / SEGMENTS),
			frac - (len * j) / SEGMENTS,
		);
		if (!d) continue;
		const k = j / SEGMENTS;
		out += `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${r2((1 - k) * 0.9)}" stroke-width="${r2(3.4 * (1 - k * 0.6))}" stroke-linecap="round"/>`;
	}
	return out;
}

export function renderComet(m: FaceModel, s: FaceStyle, a: AnimState): string {
	const c = s.active;
	let out = dimRing(R, 1, s.inactive);
	const frac = ringFraction(m, a);
	if (atZero(m)) {
		// countdown at zero: the whole ring lights up and blinks via ringOn
		if (frac > 0)
			out += `<circle cx="72" cy="72" r="${R}" fill="none" stroke="${c}" stroke-width="2.4"/>`;
	} else if (frac > MIN_FRACTION) {
		out += tail(frac, c);
		const [x, y] = polar(R, frac);
		out += head(x, y, 4.2 + 1.2 * a.glow, c);
	}

	const top = { cy: 48, height: 38, stroke: 5 };
	out += mainTwoLines(m, a, c, top, { cy: 96, height: 38, stroke: 5 });
	if (m.pm) out += pmDot(...pmPosition(splitMain(m.main)[0], top), c);
	return out;
}
