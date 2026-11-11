// Modern Minimal (V1 face 4, drawModernTime): dot ring without markers, hours and
// minutes stacked large, seconds small below. No date.
import type { FaceModel } from "../../core/clock-model";
import {
	type AnimState,
	dotRing,
	type FaceStyle,
	label,
	mainTwoLines,
	pmDot,
	subLine,
} from "./shared";

export function renderModern(m: FaceModel, s: FaceStyle, a: AnimState): string {
	const c = s.active;
	let out = dotRing(m, s, a);
	if (m.label) out += label(m.label, 24, 11, c);
	out += mainTwoLines(
		m,
		a,
		c,
		{ cy: 50, height: 30, stroke: 3.6 },
		{ cy: 88, height: 30, stroke: 3.6 },
	);
	out += subLine(m, a, c, { cy: 118, height: 13, stroke: 2.1 });
	// hours at height 30 end at x~94, top y 35
	if (m.pm) out += pmDot(101, 38, c);
	return out;
}
