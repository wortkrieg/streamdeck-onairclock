import { countdownFaceModel } from "../core/clock-model";
import type { CountdownView } from "../core/countdown";
import { formatMMSS } from "../core/format";
import { CLOCK_DEFAULTS } from "../core/settings";
import { countdownAnim } from "./animation";
import { renderDigits } from "./digits";
import { renderFace, STATIC_ANIM } from "./faces/index";
import { svgDocument } from "./svg";

/** Countdown key: idle shows the duration and a start triangle, active the line face. */
export function renderCountdownKey(
	view: CountdownView | null,
	durationSec: number,
	color: string,
): string {
	const { inactive, background } = CLOCK_DEFAULTS.colors;
	if (view === null || view.phase === "finished") {
		const digits = renderDigits(formatMMSS(durationSec), {
			cx: 72,
			cy: 64,
			height: 26,
			stroke: 3.2,
			color,
		});
		const triangle = `<path d="M67 93L78 100L67 107Z" fill="${color}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
		return svgDocument(digits + triangle, background);
	}
	const m = countdownFaceModel(view);
	return renderFace(
		"line",
		m,
		{ active: color, inactive, background },
		{ ...STATIC_ANIM, ...countdownAnim(view, m.secAgeMs) },
	);
}
