import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CountdownRegistry } from "../core/countdown";
import {
	CLOCK_DEFAULTS,
	type ClockConfig,
	type FaceId,
} from "../core/settings";
import { FAST_FPS } from "../hardware";
import { ClockController } from "./clock-controller";
import { combineFrames, Ticker } from "./ticker";

// The whole chain (Ticker, combineFrames, ClockController, faces) on fake timers:
// 15 visible clocks, as on a full Stream Deck MK.2 page. V1 drew 4 images per second.

const KEYS = 15;
const SECONDS = 10;
/** 2026-11-11 12:00:09.500 local: the ten full seconds 10..19 follow, no minute change. */
const MID_MINUTE = new Date(2026, 10, 11, 12, 0, 9, 500).getTime();
/** Half a second before a full minute (12:01:00). */
const BEFORE_MINUTE = new Date(2026, 10, 11, 12, 0, 59, 500).getTime();

interface Budget {
	/** Frames (= renders of every clock) in each full second. */
	framesPerSecond: number[];
	/** setImage calls of the busiest key in each full second. */
	imagesPerSecond: number[];
}

/** Starts a countdown of `countdownSec` on device "A" at `startMs` when given. */
function simulate(
	cfg: ClockConfig,
	startMs: number,
	countdownSec?: number,
): Budget {
	vi.setSystemTime(startMs);
	const firstSecond = Math.floor(startMs / 1000) + 1;
	const frames = new Array<number>(SECONDS).fill(0);
	const images = Array.from({ length: KEYS }, () =>
		new Array<number>(SECONDS).fill(0),
	);
	const slot = (nowMs: number) => Math.floor(nowMs / 1000) - firstSecond;

	const registry = new CountdownRegistry();
	if (countdownSec !== undefined)
		registry.press(
			"A",
			"cd",
			{
				durationSec: countdownSec,
				endMode: "overtime",
				warn: false,
				color: "#fff",
			},
			startMs,
		);
	const clocks = new ClockController(registry);
	for (let k = 0; k < KEYS; k++) {
		const perSecond = images[k] ?? [];
		clocks.add(
			{
				id: `k${k}`,
				deviceId: "A",
				kind: "key",
				draw: () => {
					const i = slot(Date.now());
					if (i >= 0 && i < SECONDS) perSecond[i] = (perSecond[i] ?? 0) + 1;
					return Promise.resolve();
				},
			},
			cfg,
		);
	}
	const ticker = new Ticker(
		combineFrames({
			clocks: (nowMs) => {
				const i = slot(nowMs);
				if (i >= 0 && i < SECONDS) frames[i] = (frames[i] ?? 0) + 1;
				return clocks.frame(nowMs);
			},
		}),
		FAST_FPS,
	);
	ticker.start();
	vi.advanceTimersByTime((SECONDS + 1) * 1000);
	ticker.stop();
	return {
		framesPerSecond: frames,
		imagesPerSecond: frames.map((_, i) =>
			Math.max(...images.map((perSecond) => perSecond[i] ?? 0)),
		),
	};
}

const cfg = (over: Partial<ClockConfig> = {}): ClockConfig => ({
	...CLOCK_DEFAULTS,
	...over,
});
const FACES: FaceId[] = ["classic", "modern", "line", "comet", "big"];
const max = (xs: number[]) => Math.max(...xs);

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe("frame budget with 15 visible clocks", () => {
	test.each(FACES)(
		"%s at defaults: at most 4 frames and 4 images per key per second",
		(face) => {
			const b = simulate(cfg({ face }), MID_MINUTE);
			expect(max(b.framesPerSecond)).toBeLessThanOrEqual(4);
			expect(max(b.imagesPerSecond)).toBeLessThanOrEqual(4);
			// Every second still gets its frames (the clock does not stall).
			expect(Math.min(...b.framesPerSecond)).toBeGreaterThanOrEqual(1);
		},
	);

	test("classic and line at defaults draw exactly 4 images per second (V1: 4)", () => {
		for (const face of ["classic", "line"] as const) {
			const b = simulate(cfg({ face }), MID_MINUTE);
			expect(b.framesPerSecond).toEqual(new Array(SECONDS).fill(4));
			expect(b.imagesPerSecond).toEqual(new Array(SECONDS).fill(4));
		}
	});

	test("animations off: 2 per second with the blinking colon, 1 without", () => {
		for (const face of ["classic", "line"] as const) {
			const blink = simulate(cfg({ face, animations: false }), MID_MINUTE);
			expect(max(blink.framesPerSecond)).toBeLessThanOrEqual(2);
			expect(max(blink.imagesPerSecond)).toBeLessThanOrEqual(2);
			const still = simulate(
				cfg({ face, animations: false, blinkColon: false }),
				MID_MINUTE,
			);
			expect(max(still.framesPerSecond)).toBeLessThanOrEqual(1);
			expect(max(still.imagesPerSecond)).toBeLessThanOrEqual(1);
		}
	});

	test("the minute change runs fast frames briefly, then back to 4 per second", () => {
		const b = simulate(cfg({ face: "classic" }), BEFORE_MINUTE);
		// Slot 0 is 12:01:00: digit roll (380 ms) and ring reset (750 ms) at FAST_FPS.
		const [minute = 0, ...rest] = b.framesPerSecond;
		expect(minute).toBeGreaterThan(4);
		expect(minute).toBeLessThanOrEqual(Math.ceil(FAST_FPS * 0.8) + 2);
		expect(max(rest)).toBeLessThanOrEqual(4);
		expect(max(b.imagesPerSecond.slice(1))).toBeLessThanOrEqual(4);
	});

	test("a short countdown redraws evenly (8 per second at 15 s), a long one does not", () => {
		const short = simulate(cfg({ face: "line" }), MID_MINUTE, 15);
		// Running for 15 s from slot 0 on: the 8 even ring frames plus the afterglow
		// steps that do not coincide with them, never more than FAST_FPS + 2.
		const running = short.imagesPerSecond.slice(0, 9);
		expect(Math.min(...running)).toBeGreaterThanOrEqual(8);
		expect(max(running)).toBeLessThanOrEqual(FAST_FPS + 2);
		// From 2 minutes on the ring adds no frames: still at most 6 per second.
		const long = simulate(cfg({ face: "line" }), MID_MINUTE, 300);
		expect(max(long.imagesPerSecond)).toBeLessThanOrEqual(6);
	});
});
