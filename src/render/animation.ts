import type { FaceModel } from "../core/clock-model";
import type { CountdownView } from "../core/countdown";
import type { ClockConfig, FaceId } from "../core/settings";
import type { AnimState } from "./faces";

export const ROLL_MS = 380;
export const WIPE_MS = 750;
export const BLINK_MS = 500;
export const WARN_LAST_MS = 10000;

/**
 * The afterglow is stepped, not continuous: [ms into the second, glow]. Full at the
 * second, then fading, off from 500 ms (when the colon dims). The ticker wakes only at
 * these steps (STEP_PHASES_MS) instead of running fast frames every second, so a default
 * clock draws at most 4 images per second, like V1.
 */
export const GLOW_STEPS: ReadonlyArray<readonly [number, number]> = [
	[0, 1],
	[150, 0.55],
	[300, 0.25],
	[500, 0],
];
/** ms into the second at which the stepped animations (afterglow, seconds roll) change. */
export const STEP_PHASES_MS: readonly number[] = GLOW_STEPS.map(([at]) => at);
/** Faces whose seconds ring (or bar) is a continuous sweep rather than 60 dots. */
export const SWEEP_FACES: readonly FaceId[] = ["line", "comet", "big"];
/**
 * Clock-mode phases of the sweeping faces: an even grid of `fps` frames per second
 * (every 100 ms at 10 fps), so the ring moves smoothly. They replace STEP_PHASES_MS for
 * these faces: the stepped afterglow and seconds roll are sampled on the grid, and the
 * colon's 500 ms lies on it, so no extra frames come in between.
 */
export function sweepPhasesMs(fps: number): number[] {
	const n = Math.max(1, Math.round(fps));
	return Array.from({ length: n }, (_, k) => Math.round((k * 1000) / n));
}
/** The seconds digits show one in-between roll image until the first step, then settle. */
const SUB_ROLL_STEP = 0.4;
const [, SUB_ROLL_STEP_END_MS = 0] = STEP_PHASES_MS;

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

/** Afterglow at `ageMs` into the second (see GLOW_STEPS). */
function glowAt(ageMs: number): number {
	let glow = 0;
	for (const [at, value] of GLOW_STEPS) if (ageMs >= at) glow = value;
	return glow;
}

/**
 * Animation parameters for one frame. roll, subRoll and wipe stay linear: the digits
 * and the ring apply the ease-out themselves. Roll and wipe are continuous and need
 * fast frames; the afterglow and the seconds roll are stepped (STEP_PHASES_MS).
 */
export function animState(
	m: FaceModel,
	cfg: Pick<ClockConfig, "animations" | "blinkColon">,
): AnimState {
	const clock = m.mode === "clock";
	const anim = cfg.animations;
	const secPhase = mod(m.secAgeMs, 1000);
	const roll = anim ? progress(m.mainAgeMs, ROLL_MS) : 1;

	let subRoll = 1;
	if (anim && clock) {
		// At the full minute the seconds roll with the minutes on the fast frames.
		if (roll < 1) subRoll = progress(m.subAgeMs, ROLL_MS);
		else if (m.subAgeMs < SUB_ROLL_STEP_END_MS) subRoll = SUB_ROLL_STEP;
	}

	return {
		roll,
		subRoll,
		wipe: anim && clock ? progress(m.minuteAgeMs, WIPE_MS) : 1,
		glow: anim ? glowAt(m.secAgeMs) : 0,
		colonOpacity:
			cfg.blinkColon && clock && secPhase >= BLINK_MS ? COLON_DIM : 1,
		...countdownAnim(m.countdown, m.secAgeMs),
	};
}

/** Largest ring movement per frame of a running countdown, in degrees. */
const RING_STEP_DEG = 3;

/**
 * Evenly spaced phases (ms within the countdown's own second) at which a running
 * countdown redraws, so that its ring moves smoothly by at most RING_STEP_DEG per frame:
 * 8 per second at 15 s, 4 at 30 s, 2 at 60 s, none extra from 2 minutes on. Capped at
 * fastFps. Uneven frames (only the afterglow steps) made short countdowns jump.
 */
export function countdownRingPhasesMs(
	startMs: number,
	durationMs: number,
	fastFps: number,
): number[] {
	const degPerSec = durationMs > 0 ? 360_000 / durationMs : 0;
	const n = Math.min(
		fastFps,
		Math.max(1, Math.ceil(degPerSec / RING_STEP_DEG - 1e-9)),
	);
	return Array.from({ length: n }, (_, k) =>
		mod(startMs + Math.round((k * 1000) / n), 1000),
	);
}

/**
 * True while a faster frame rate is needed: digit roll, ring reset, countdown pulse and
 * flash. The stepped afterglow and seconds roll only need frames at STEP_PHASES_MS.
 */
export function isAnimating(a: AnimState): boolean {
	return a.roll < 1 || a.wipe < 1 || a.pulse !== 1 || a.flash;
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
