import {
	type Countdown,
	type CountdownView,
	countdownDigits,
	viewCountdown,
} from "./countdown";
import { displayHour, formatDate, isPm, pad2 } from "./format";
import type { ClockConfig, FaceId } from "./settings";
import { type WallTime, wallTime } from "./time";

/** Everything a face needs to draw one frame. Pure data, no styling. */
export interface FaceModel {
	mode: "clock" | "countdown";
	/** "16:59" or the countdown digits; previous value and ms since it changed. */
	main: string;
	prevMain: string;
	mainAgeMs: number;
	/** Seconds (clock only, only with showSeconds). */
	sub?: string;
	prevSub?: string;
	subAgeMs: number;
	date?: string;
	label?: string;
	pm: boolean;
	/** Clock: (s + ms/1000)/60. Countdown running: remaining share. Otherwise 0. */
	fraction: number;
	/** Active dots 0-60 (clock: s+1, countdown: ceil(fraction*60)). */
	step: number;
	secAgeMs: number;
	minuteAgeMs: number;
	countdown?: CountdownView;
}

/** Faces that draw a date line (when showDate is on). */
const FACES_WITH_DATE: readonly FaceId[] = ["classic"];
/** Age reported for digits that do not change (hold/flash) and "no wipe" in countdown mode. */
const STILL_MS = 9999;
const NO_WIPE_MS = 99999;

function hhmm(t: WallTime, hour12: boolean): string {
	return `${pad2(displayHour(t.hour, hour12))}:${pad2(t.minute)}`;
}

function clockModel(nowMs: number, cfg: ClockConfig): FaceModel {
	const t = wallTime(nowMs, cfg.zone);
	const minuteAgeMs = t.second * 1000 + t.ms;
	// Wall time one minute earlier (not arithmetic) so DST jumps roll correctly.
	const prev = wallTime(nowMs - 60000, cfg.zone);
	const seconds = cfg.showSeconds;
	return {
		mode: "clock",
		main: hhmm(t, cfg.hour12),
		prevMain: hhmm(prev, cfg.hour12),
		mainAgeMs: minuteAgeMs,
		sub: seconds ? pad2(t.second) : undefined,
		prevSub: seconds ? pad2((t.second + 59) % 60) : undefined,
		subAgeMs: t.ms,
		date:
			cfg.showDate && FACES_WITH_DATE.includes(cfg.face)
				? formatDate(t, cfg.dateFormat)
				: undefined,
		label: cfg.label || undefined,
		pm: cfg.hour12 && cfg.pmIndicator && isPm(t.hour),
		fraction: (t.second + t.ms / 1000) / 60,
		step: t.second + 1,
		secAgeMs: t.ms,
		minuteAgeMs,
	};
}

/** ms since the countdown digits last changed, and the 1 s blink/pulse age. */
function countdownAges(v: CountdownView): { main: number; sec: number } {
	switch (v.phase) {
		case "running": {
			// ceil(remaining / 1000) changed when remaining hit the last full second.
			const age = Math.ceil(v.remainingMs / 1000) * 1000 - v.remainingMs;
			return { main: age, sec: age };
		}
		case "overtime": {
			const age = v.overMs % 1000;
			return { main: age, sec: age };
		}
		case "hold":
		case "flash":
			return { main: STILL_MS, sec: v.sinceZeroMs % 1000 };
		case "finished":
			return { main: STILL_MS, sec: 0 };
	}
}

/**
 * Face model for a countdown view. `prev` is the view one second earlier; its digits
 * are used for the roll unless the length differs (e.g. "00:01" -> "+00:00").
 */
export function countdownFaceModel(
	view: CountdownView,
	prev: CountdownView = view,
): FaceModel {
	const main = countdownDigits(view);
	const prevDigits = countdownDigits(prev);
	const ages = countdownAges(view);
	const fraction = view.phase === "running" ? view.fraction : 0;
	return {
		mode: "countdown",
		main,
		prevMain: prevDigits.length === main.length ? prevDigits : main,
		mainAgeMs: ages.main,
		subAgeMs: ages.sec,
		pm: false,
		fraction,
		// Epsilon guards float noise: (31000 / 60000) * 60 = 31.000000000000004.
		step: Math.max(0, Math.ceil(fraction * 60 - 1e-9)),
		secAgeMs: ages.sec,
		minuteAgeMs: NO_WIPE_MS,
		countdown: view,
	};
}

export function buildFaceModel(
	nowMs: number,
	cfg: ClockConfig,
	cd?: { countdown: Countdown; view: CountdownView },
): FaceModel {
	if (cd && cfg.showCountdown && cd.view.phase !== "finished") {
		return countdownFaceModel(
			cd.view,
			viewCountdown(cd.countdown, nowMs - 1000),
		);
	}
	return clockModel(nowMs, cfg);
}
