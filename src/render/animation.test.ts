import { describe, expect, test } from "vitest";
import type { FaceModel } from "../core/clock-model";
import type { CountdownView } from "../core/countdown";
import { animState, isAnimating, planNextFrame } from "./animation";
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
	test("roll, subRoll, wipe, glow", () => {
		expect(animState({ ...base, mainAgeMs: 190 }, on).roll).toBeCloseTo(0.5);
		expect(animState({ ...base, subAgeMs: 190 }, on).subRoll).toBeCloseTo(0.5);
		expect(animState({ ...base, minuteAgeMs: 375 }, on).wipe).toBeCloseTo(0.5);
		expect(animState({ ...base, secAgeMs: 300 }, on).glow).toBeCloseTo(0.5);
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
	test.each([
		{ roll: 0.5 },
		{ subRoll: 0.5 },
		{ wipe: 0.5 },
		{ glow: 0.1 },
		{ pulse: 0.8 },
		{ flash: true },
	])("%o", (p) => expect(isAnimating({ ...STATIC_ANIM, ...p })).toBe(true));
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
