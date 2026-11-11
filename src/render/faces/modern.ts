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
	pmPosition,
	splitMain,
	subLine,
} from "./shared";

// V1 proportions: digits about 32 high on a 40 line pitch, seconds about 16 high.
const PLAIN = {
	top: { cy: 43, height: 32, stroke: 4.6 },
	bottom: { cy: 83, height: 32, stroke: 4.6 },
	sub: { cy: 115, height: 17, stroke: 3 },
};
// With a label on top the rows move down and shrink a little.
const LABELLED = {
	top: { cy: 52, height: 28, stroke: 4.2 },
	bottom: { cy: 87, height: 28, stroke: 4.2 },
	sub: { cy: 116, height: 15, stroke: 2.8 },
};

export function renderModern(m: FaceModel, s: FaceStyle, a: AnimState): string {
	const c = s.active;
	let out = dotRing(m, s, a);
	const top = m.label ? label(m.label, 25, 17, c, 64) : "";
	const g = top ? LABELLED : PLAIN;
	out += top;
	out += mainTwoLines(m, a, c, g.top, g.bottom);
	out += subLine(m, a, c, g.sub);
	if (m.pm) out += pmDot(...pmPosition(splitMain(m.main)[0], g.top), c);
	return out;
}
