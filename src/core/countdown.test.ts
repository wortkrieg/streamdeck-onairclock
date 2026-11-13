import { describe, expect, test } from "vitest";
import {
	adjustDuration,
	type Countdown,
	CountdownRegistry,
	countdownDigits,
	FLASH_MS,
	viewCountdown,
} from "./countdown";
import type { CountdownConfig } from "./settings";

const t0 = 1_000_000;
const mk = (over: Partial<Countdown> = {}): Countdown => ({
	deviceId: "d",
	sourceActionId: "a",
	startMs: t0,
	durationMs: 5000,
	endMode: "overtime",
	warn: false,
	...over,
});
const cfg = (over: Partial<CountdownConfig> = {}): CountdownConfig => ({
	durationSec: 5,
	endMode: "overtime",
	warn: false,
	color: "#fff",
	adjustable: true,
	...over,
});

describe("viewCountdown", () => {
	test("start is running with full fraction", () => {
		const v = viewCountdown(mk(), t0);
		expect(v).toEqual({
			phase: "running",
			remainingMs: 5000,
			fraction: 1,
			warn: false,
		});
		expect(countdownDigits(v)).toBe("00:05");
	});
	test("digits round up", () => {
		expect(countdownDigits(viewCountdown(mk(), t0 + 4001))).toBe("00:01");
	});
	test("overtime", () => {
		const v = viewCountdown(mk(), t0 + 5000);
		expect(v).toEqual({ phase: "overtime", overMs: 0 });
		expect(countdownDigits(v)).toBe("+00:00");
		expect(countdownDigits(viewCountdown(mk(), t0 + 6500))).toBe("+00:01");
	});
	test("hold", () => {
		const v = viewCountdown(mk({ endMode: "hold" }), t0 + 9000);
		expect(v).toEqual({ phase: "hold", sinceZeroMs: 4000 });
		expect(countdownDigits(v)).toBe("00:00");
	});
	test("clock flashes then finishes", () => {
		const c = mk({ endMode: "clock" });
		expect(viewCountdown(c, t0 + 6000)).toEqual({
			phase: "flash",
			sinceZeroMs: 1000,
		});
		expect(countdownDigits(viewCountdown(c, t0 + 6000))).toBe("00:00");
		expect(viewCountdown(c, t0 + 5000 + FLASH_MS)).toEqual({
			phase: "finished",
		});
	});
	test("warn only with cfg.warn and <= 10s", () => {
		const long = { durationMs: 60000 };
		expect(
			viewCountdown(mk({ ...long, warn: true }), t0 + 50000),
		).toMatchObject({ warn: true });
		expect(
			viewCountdown(mk({ ...long, warn: true }), t0 + 49999),
		).toMatchObject({ warn: false });
		expect(
			viewCountdown(mk({ ...long, warn: false }), t0 + 55000),
		).toMatchObject({ warn: false });
	});
	test("backwards clock", () => {
		expect(viewCountdown(mk(), t0 - 500)).toEqual({
			phase: "running",
			remainingMs: 5000,
			fraction: 1,
			warn: false,
		});
	});
});

describe("CountdownRegistry", () => {
	test("press toggles for the same action", () => {
		const r = new CountdownRegistry();
		expect(r.press("d", "a", cfg(), t0)).toBe("started");
		expect(r.press("d", "a", cfg(), t0 + 1)).toBe("cancelled");
		expect(r.get("d", t0 + 2)).toBeUndefined();
	});
	test("another action replaces", () => {
		const r = new CountdownRegistry();
		r.press("d", "a", cfg(), t0);
		expect(r.press("d", "b", cfg(), t0 + 1)).toBe("started");
		expect(r.get("d", t0 + 2)?.sourceActionId).toBe("b");
	});
	test("devices are independent", () => {
		const r = new CountdownRegistry();
		r.press("A", "a", cfg(), t0);
		r.press("B", "a", cfg({ durationSec: 9 }), t0);
		expect(r.cancel("A")).toBe(true);
		expect(r.cancel("A")).toBe(false);
		expect(r.get("B", t0)?.durationMs).toBe(9000);
	});
	test("get after a gap gives correct remaining time", () => {
		const r = new CountdownRegistry();
		r.press("d", "a", cfg({ durationSec: 60 }), t0);
		const c = r.get("d", t0 + 30000);
		expect(c && viewCountdown(c, t0 + 30000)).toMatchObject({
			remainingMs: 30000,
		});
	});
	test("finished clock entries are removed", () => {
		const r = new CountdownRegistry();
		r.press("d", "a", cfg({ endMode: "clock" }), t0);
		expect(r.get("d", t0 + 6000)).toBeDefined();
		expect(r.get("d", t0 + 7000)).toBeUndefined();
		expect(r.get("d", t0 + 7001)).toBeUndefined();
	});
	test("hold and overtime stay", () => {
		const r = new CountdownRegistry();
		r.press("d", "a", cfg({ endMode: "hold" }), t0);
		expect(r.get("d", t0 + 99999)).toBeDefined();
	});
});

describe("adjustDuration", () => {
	test("adds and subtracts the step", () => {
		expect(adjustDuration(300, 60)).toBe(360);
		expect(adjustDuration(300, -10)).toBe(290);
	});

	test("stops at 99:59", () => {
		expect(adjustDuration(5950, 60)).toBe(5999);
		expect(adjustDuration(5999, 1)).toBe(5999);
	});

	test("never reaches zero: a step that would is left out", () => {
		expect(adjustDuration(60, -60)).toBe(60);
		expect(adjustDuration(30, -60)).toBe(30);
		expect(adjustDuration(2, -1)).toBe(1);
	});
});

describe("CountdownRegistry.adjust", () => {
	const viewAt = (r: CountdownRegistry, at: number) => {
		const c = r.get("d", at);
		if (!c) throw new Error("no countdown");
		return viewCountdown(c, at);
	};

	test("changes the remaining time of a running countdown", () => {
		const r = new CountdownRegistry();
		r.press("d", "a", cfg({ durationSec: 60 }), t0);
		expect(r.adjust("d", 60, t0 + 20_000)).toBe(true);
		expect(viewAt(r, t0 + 20_000)).toMatchObject({
			phase: "running",
			remainingMs: 100_000,
			fraction: 100_000 / 120_000,
		});
		expect(r.adjust("d", -30, t0 + 20_000)).toBe(true);
		expect(viewAt(r, t0 + 20_000)).toMatchObject({ remainingMs: 70_000 });
		expect(viewAt(r, t0 + 90_000).phase).toBe("overtime");
	});

	test("minus down to zero ends it like reaching zero", () => {
		const r = new CountdownRegistry();
		r.press("d", "a", cfg({ durationSec: 60 }), t0);
		expect(r.adjust("d", -600, t0 + 20_000)).toBe(true);
		expect(viewAt(r, t0 + 20_000)).toEqual({ phase: "overtime", overMs: 0 });
	});

	test("plus stops at 99:59 remaining", () => {
		const r = new CountdownRegistry();
		r.press("d", "a", cfg({ durationSec: 60 }), t0);
		r.adjust("d", 6000, t0 + 1000);
		expect(viewAt(r, t0 + 1000)).toMatchObject({ remainingMs: 5_999_000 });
	});

	test("does nothing without a running countdown on that device", () => {
		const r = new CountdownRegistry();
		expect(r.adjust("d", 60, t0)).toBe(false);
		r.press("d", "a", cfg({ durationSec: 5 }), t0);
		expect(r.adjust("other", 60, t0)).toBe(false);
		// Past zero the countdown is over; + and − set durations again.
		expect(r.adjust("d", 60, t0 + 6000)).toBe(false);
		expect(viewAt(r, t0 + 6000)).toEqual({ phase: "overtime", overMs: 1000 });
	});
});
