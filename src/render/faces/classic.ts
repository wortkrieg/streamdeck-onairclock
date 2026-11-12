// Classic (V1 default): 60 dots, 12 hour markers, time, optional date and seconds.
// Geometry from the v2 mockup; markers in the inactive color (V1 parity).
import type { FaceModel } from "../../core/clock-model";
import { renderDigits } from "../digits";
import { polar } from "../geometry";
import {
	type AnimState,
	boxHeight,
	dot,
	dotRing,
	type FaceStyle,
	label,
	mainLine,
	pmDot,
	pmPosition,
	subLine,
} from "./shared";

const MARK_R = 58;
const DATE_CY = 41;
const MAIN = { cy: 72, height: 26, stroke: 4, maxWidth: 98 };

export function renderClassic(
	m: FaceModel,
	s: FaceStyle,
	a: AnimState,
): string {
	const t = s.time;
	let out = dotRing(m, s, a);
	for (let k = 0; k < 12; k++) {
		const [x, y] = polar(MARK_R, k / 12);
		out += dot(x, y, k ? 1.8 : 2.4, s.inactive);
	}

	// The label takes the date line; without text support the date stays.
	const top = m.label ? label(m.label, DATE_CY, 20, t, 76) : "";
	if (top) out += top;
	else if (m.date) {
		const box = { cy: DATE_CY, height: 14, stroke: 2.6, maxWidth: 74 };
		out += renderDigits(m.date, {
			...box,
			cx: 72,
			height: boxHeight(m.date, box),
			color: t,
		});
	}
	out += mainLine(m, a, t, MAIN);
	out += subLine(m, a, t, { cy: 103, height: 17, stroke: 2.9 });
	if (m.pm) out += pmDot(...pmPosition(m.main, MAIN), t);
	return out;
}
