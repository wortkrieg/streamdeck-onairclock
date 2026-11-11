import type { FaceModel } from "../core/clock-model";
import type { CountdownView } from "../core/countdown";
import type { ClockConfig } from "../core/settings";
import type { AnimState } from "./faces";

export const ROLL_MS = 380;
export const WIPE_MS = 750;
export const GLOW_MS = 600;
export const BLINK_MS = 500;
export const WARN_LAST_MS = 10000;

const COLON_DIM = 0.2;
const SAFETY_MS = 5;
const MIN_DELAY_MS = 10;
const FLASH_ON_MS = 180;
const PULSE_MIN = 0.6;

const clamp01 = (k: number): number => Math.min(1, Math.max(0, k));
const progress = (ageMs: number, durationMs: number): number =>
	clamp01(ageMs / durationMs);
/** Positive modulo, also for negative values. */
const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** The countdown's own animation: warning pulse, ring blink and end flash. */
export function countdownAnim(
	cv: CountdownView | undefined,
	secAgeMs: number,
): Pick<AnimState, "pulse" | "ringOn" | "flash"> {
	let pulse = 1;
	if (cv?.phase === "running" && cv.warn && cv.remainingMs <= WARN_LAST_MS) {
		const k = mod(cv.remainingMs, 1000) / 1000;
		pulse =
			(1 + PULSE_MIN) / 2 + ((1 - PULSE_MIN) / 2) * Math.cos(2 * Math.PI * k);
	}
	const blinking =
		cv?.phase === "overtime" || cv?.phase === "hold" || cv?.phase === "flash";
	return {
		pulse,
		ringOn: blinking ? mod(secAgeMs, 1000) < BLINK_MS : true,
		flash: cv?.phase === "flash" && mod(cv.sinceZeroMs, 1000) < FLASH_ON_MS,
	};
}

/**
 * Animation parameters for one frame. roll, subRoll and wipe stay linear: the digits
 * and the ring apply the ease-out themselves.
 */
export function animState(
	m: FaceModel,
	cfg: Pick<ClockConfig, "animations" | "blinkColon">,
): AnimState {
	const clock = m.mode === "clock";
	const anim = cfg.animations;
	const secPhase = mod(m.secAgeMs, 1000);

	return {
		roll: anim ? progress(m.mainAgeMs, ROLL_MS) : 1,
		subRoll: anim && clock ? progress(m.subAgeMs, ROLL_MS) : 1,
		wipe: anim && clock ? progress(m.minuteAgeMs, WIPE_MS) : 1,
		glow: anim ? 1 - progress(m.secAgeMs, GLOW_MS) : 0,
		colonOpacity:
			cfg.blinkColon && clock && secPhase >= BLINK_MS ? COLON_DIM : 1,
		...countdownAnim(m.countdown, m.secAgeMs),
	};
}

/** True while a faster frame rate is needed. */
export function isAnimating(a: AnimState): boolean {
	return (
		a.roll < 1 ||
		(a.subRoll ?? 1) < 1 ||
		a.wipe < 1 ||
		a.glow > 0 ||
		a.pulse !== 1 ||
		a.flash
	);
}

/**
 * Delay in ms until the next frame: fast frames, or the nearest upcoming phase
 * boundary (ms offsets within a second) plus a small safety margin.
 * Always within [10, 1010], also for odd or backwards-jumping clocks.
 */
export function planNextFrame(
	nowMs: number,
	phasesMs: number[],
	fast: boolean,
	fastFps: number,
): number {
	if (fast) return Math.max(MIN_DELAY_MS, Math.round(1000 / fastFps));
	let delay = 1000;
	for (const p of phasesMs)
		delay = Math.min(delay, 1000 - mod(nowMs - p, 1000));
	return Math.min(1000 + SAFETY_MS, Math.max(MIN_DELAY_MS, delay + SAFETY_MS));
}
