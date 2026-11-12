import { describe, expect, test } from "vitest";
import type { FaceModel } from "../core/clock-model";
import type { CountdownView } from "../core/countdown";
import {
	animState,
	BLINK_MS,
	countdownRingPhasesMs,
	GLOW_STEPS,
	isAnimating,
	planNextFrame,
	STEP_PHASES_MS,
	sweepPhasesMs,
} from "./animation";
import { STATIC_ANIM } from "./faces";

const base: FaceModel = {
	mode: "clock",
	main: "12:34",
	prevMain: "12:33",
	mainAgeMs: 9999,
	sub: "05",
	prevSub: "04",
	subAgeMs: 9999,
	pm: false,
	fraction: 0.1,
	step: 6,
	secAgeMs: 9999,
	minuteAgeMs: 9999,
};
const on = { animations: true, blinkColon: true };
const cd = (
	countdown: CountdownView,
	o: Partial<FaceModel> = {},
): FaceModel => ({
	...base,
	mode: "countdown",
	countdown,
	...o,
});

describe("animState", () => {
	test("animations off", () => {
		const a = animState(
			{ ...base, mainAgeMs: 10, minuteAgeMs: 10, secAgeMs: 10, subAgeMs: 10 },
			{ animations: false, blinkColon: false },
		);
		expect(a.roll).toBe(1);
		expect(a.wipe).toBe(1);
		expect(a.glow).toBe(0);
		expect(a.subRoll).toBe(1);
	});
	test("roll and wipe are continuous", () => {
		expect(animState({ ...base, mainAgeMs: 190 }, on).roll).toBeCloseTo(0.5);
		expect(animState({ ...base, minuteAgeMs: 375 }, on).wipe).toBeCloseTo(0.5);
	});
	test("afterglow is stepped: full, 0.55, 0.25, off from 500 ms", () => {
		const glow = (secAgeMs: number) =>
			animState({ ...base, secAgeMs }, on).glow;
		expect([0, 149, 150, 299, 300, 499, 500, 999].map(glow)).toEqual([
			1, 1, 0.55, 0.55, 0.25, 0.25, 0, 0,
		]);
		expect(GLOW_STEPS).toEqual([
			[0, 1],
			[150, 0.55],
			[300, 0.25],
			[500, 0],
		]);
		expect(STEP_PHASES_MS).toEqual([0, 150, 300, 500]);
	});
	test("seconds roll in one in-between step, with the minutes at the full minute", () => {
		const sub = (subAgeMs: number, mainAgeMs = 9999) =>
			animState({ ...base, subAgeMs, mainAgeMs }, on).subRoll;
		expect([0, 149, 150, 380, 999].map((t) => sub(t))).toEqual([
			0.4, 0.4, 1, 1, 1,
		]);
		// At the full minute the main digits roll on fast frames; the seconds follow them.
		expect(sub(190, 190)).toBeCloseTo(0.5);
		expect(sub(50, 50)).toBeCloseTo(50 / 380);
		expect(
			animState({ ...base, subAgeMs: 10 }, { ...on, animations: false })
				.subRoll,
		).toBe(1);
	});
	test("stepped values change only at STEP_PHASES_MS", () => {
		const at = (t: number) => {
			const a = animState(
				{ ...base, secAgeMs: t, subAgeMs: t, mainAgeMs: 5000 + t },
				on,
			);
			return `${a.glow}/${a.subRoll}`;
		};
		for (let t = 0; t < 1000; t++) {
			const phase = Math.max(...STEP_PHASES_MS.filter((p) => p <= t));
			expect(at(t), `${t} ms`).toBe(at(phase));
		}
	});
	test("countdown: the afterglow steps on the countdown's own second", () => {
		const run = (secAgeMs: number) =>
			animState(
				cd(
					{ phase: "running", remainingMs: 50000, fraction: 0.5, warn: false },
					{ secAgeMs },
				),
				on,
			).glow;
		expect([0, 200, 400, 600].map(run)).toEqual([1, 0.55, 0.25, 0]);
	});
	test("countdown: roll yes, wipe always 1", () => {
		const m = cd(
			{ phase: "running", remainingMs: 50000, fraction: 0.5, warn: false },
			{ mainAgeMs: 190, minuteAgeMs: 10 },
		);
		expect(animState(m, on).roll).toBeCloseTo(0.5);
		expect(animState(m, on).wipe).toBe(1);
	});
	test("colon blink", () => {
		expect(animState({ ...base, secAgeMs: 499 }, on).colonOpacity).toBe(1);
		expect(animState({ ...base, secAgeMs: 600 }, on).colonOpacity).toBe(0.2);
		expect(
			animState({ ...base, secAgeMs: 600 }, { ...on, blinkColon: false })
				.colonOpacity,
		).toBe(1);
		const m = cd(
			{ phase: "running", remainingMs: 5000, fraction: 0.5, warn: false },
			{ secAgeMs: 600 },
		);
		expect(animState(m, on).colonOpacity).toBe(1);
	});
	test("pulse", () => {
		const run = (warn: boolean, remainingMs: number) =>
			animState(cd({ phase: "running", remainingMs, fraction: 0.1, warn }), on)
				.pulse;
		for (const r of [9000, 8750, 8500, 8250]) {
			expect(run(true, r)).toBeGreaterThanOrEqual(0.6);
			expect(run(true, r)).toBeLessThanOrEqual(1);
		}
		expect(run(false, 8500)).toBe(1);
	});
	test("ring blinking and flash ignore animations", () => {
		const off = { animations: false, blinkColon: false };
		const over = cd({ phase: "overtime", overMs: 1600 }, { secAgeMs: 600 });
		expect(animState(over, off).ringOn).toBe(false);
		expect(animState({ ...over, secAgeMs: 100 }, off).ringOn).toBe(true);
		const fl = (s: number) =>
			animState(cd({ phase: "flash", sinceZeroMs: s }), off).flash;
		expect(fl(100)).toBe(true);
		expect(fl(1100)).toBe(true);
		expect(fl(300)).toBe(false);
		expect(animState(base, on).flash).toBe(false);
		expect(animState(base, on).ringOn).toBe(true);
	});
});

describe("isAnimating", () => {
	test("static is idle", () => expect(isAnimating(STATIC_ANIM)).toBe(false));
	test.each([{ roll: 0.5 }, { wipe: 0.5 }, { pulse: 0.8 }, { flash: true }])(
		"%o",
		(p) => expect(isAnimating({ ...STATIC_ANIM, ...p })).toBe(true),
	);
	// Stepped animations are driven by STEP_PHASES_MS, not by fast frames.
	test.each([{ glow: 1 }, { glow: 0.25 }, { subRoll: 0.4 }])(
		"stepped %o is not fast",
		(p) => expect(isAnimating({ ...STATIC_ANIM, ...p })).toBe(false),
	);
	test("a default clock is not fast between minute changes", () => {
		for (const t of [5, 155, 305, 505])
			expect(
				isAnimating(
					animState(
						{ ...base, secAgeMs: t, subAgeMs: t, mainAgeMs: 7000 + t },
						on,
					),
				),
			).toBe(false);
	});
});

describe("planNextFrame", () => {
	test("second boundary", () => {
		const d = planNextFrame(1000.0, [0], false, 12);
		expect(d).toBeGreaterThanOrEqual(1000);
		expect(d).toBeLessThanOrEqual(1010);
	});
	test("nearest phase", () => {
		const near = (d: number, target: number) => {
			expect(d).toBeGreaterThanOrEqual(target);
			expect(d).toBeLessThanOrEqual(target + 10);
		};
		near(planNextFrame(1250, [0, 500], false, 12), 250);
		near(planNextFrame(1000, [730], false, 12), 730);
	});
	test("fast", () => expect(planNextFrame(1234, [0], true, 12)).toBe(83));
	test("odd clocks stay bounded", () => {
		for (const now of [-5, -1000.5, -1, 0, 1e12 + 0.3]) {
			const d = planNextFrame(now, [0, 500], false, 12);
			expect(d).toBeGreaterThanOrEqual(10);
			expect(d).toBeLessThanOrEqual(1010);
		}
	});
});

describe("countdownRingPhasesMs", () => {
	const spacing = (p: number[]) =>
		[...p]
			.sort((a, b) => a - b)
			.map((v, i, a) => (a[i + 1] ?? (a[0] ?? 0) + 1000) - v);

	test("short countdowns redraw evenly, at most 3 degrees per frame", () => {
		expect(countdownRingPhasesMs(0, 15_000, 10)).toHaveLength(8); // 24 deg/s
		expect(spacing(countdownRingPhasesMs(0, 15_000, 10))).toEqual(
			new Array(8).fill(125),
		);
		expect(countdownRingPhasesMs(0, 30_000, 10)).toHaveLength(4);
		expect(countdownRingPhasesMs(0, 60_000, 10)).toHaveLength(2);
	});
	test("from two minutes on no extra frames, very short ones capped at fastFps", () => {
		expect(countdownRingPhasesMs(0, 120_000, 10)).toEqual([0]);
		expect(countdownRingPhasesMs(0, 300_000, 10)).toEqual([0]);
		expect(countdownRingPhasesMs(0, 5_000, 10)).toHaveLength(10);
	});
	test("phases follow the countdown's own second", () => {
		expect(countdownRingPhasesMs(1_000_300, 30_000, 10)).toEqual([
			300, 550, 800, 50,
		]);
	});
});

describe("sweepPhasesMs", () => {
	test("an even grid that contains the colon's 500 ms", () => {
		expect(sweepPhasesMs(10)).toEqual([
			0, 100, 200, 300, 400, 500, 600, 700, 800, 900,
		]);
		expect(sweepPhasesMs(10)).toContain(BLINK_MS);
		expect(sweepPhasesMs(4)).toEqual([0, 250, 500, 750]);
	});
});
