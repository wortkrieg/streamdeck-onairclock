// Classic (V1 default): 60 dots, 12 hour markers, time, optional date and seconds.
// Geometry from the v2 mockup; markers in the inactive color (V1 parity).
import type { FaceModel } from "../../core/clock-model";
import { renderDigits } from "../digits";
import { polar } from "../geometry";
import {
	type AnimState,
	dot,
	dotRing,
	type FaceStyle,
	label,
	mainLine,
	pmDot,
	subLine,
} from "./shared";

const MARK_R = 53;
const DATE_CY = 47;

export function renderClassic(
	m: FaceModel,
	s: FaceStyle,
	a: AnimState,
): string {
	const c = s.active;
	let out = dotRing(m, s, a);
	for (let k = 0; k < 12; k++) {
		const [x, y] = polar(MARK_R, k / 12);
		out += dot(x, y, k ? 1.7 : 2.3, s.inactive);
	}

	// The label takes the date line; without text support the date stays.
	const top = m.label ? label(m.label, DATE_CY, 13, c) : "";
	if (top) out += top;
	else if (m.date) {
		out += renderDigits(m.date, {
			cx: 72,
			cy: DATE_CY,
			height: 9,
			stroke: 1.5,
			color: c,
		});
	}
	const cd = m.mode === "countdown";
	out += mainLine(m, a, c, {
		cy: cd ? 72 : 71,
		height: cd ? 21 : 19,
		stroke: 2.5,
	});
	out += subLine(m, a, c, { cy: 96, height: 10, stroke: 1.9 });
	// main "16:59" at height 19 ends at x~106, top y~61.5
	if (m.pm) out += pmDot(112.5, 63.5, c);
	return out;
}
