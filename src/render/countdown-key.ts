import { countdownFaceModel } from "../core/clock-model";
import type { CountdownView } from "../core/countdown";
import { formatMMSS } from "../core/format";
import { CLOCK_DEFAULTS } from "../core/settings";
import { renderDigits } from "./digits";
import { type AnimState, renderFace, STATIC_ANIM } from "./faces/index";
import { svgDocument } from "./svg";

const BLINK_ON_MS = 500;
const FLASH_ON_MS = 180;

/**
 * The key renders without the clock's animation input, so blink, flash and warning
 * pulse are derived from the view itself (1 s cycle from the phase age).
 */
function keyAnim(secAgeMs: number, view: CountdownView): AnimState {
	switch (view.phase) {
		case "running":
			return view.warn
				? {
						...STATIC_ANIM,
						pulse: 0.8 + 0.2 * Math.cos((2 * Math.PI * secAgeMs) / 1000),
					}
				: STATIC_ANIM;
		case "overtime":
		case "hold":
			return { ...STATIC_ANIM, ringOn: secAgeMs < BLINK_ON_MS };
		case "flash":
			return {
				...STATIC_ANIM,
				ringOn: secAgeMs < BLINK_ON_MS,
				flash: secAgeMs < FLASH_ON_MS,
			};
		case "finished":
			return STATIC_ANIM;
	}
}

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
		keyAnim(m.secAgeMs, view),
	);
}
