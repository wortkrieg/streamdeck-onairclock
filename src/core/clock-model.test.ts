import { describe, expect, test } from "vitest";
import { buildFaceModel } from "./clock-model";
import { type Countdown, viewCountdown } from "./countdown";
import { CLOCK_DEFAULTS, type ClockConfig } from "./settings";

// 2026-11-11 16:59:53.250 local time (vitest runs with TZ=Europe/Berlin).
const NOW = new Date(2026, 10, 11, 16, 59, 53, 250).getTime();
const cfg = (over: Partial<ClockConfig> = {}): ClockConfig => ({
	...CLOCK_DEFAULTS,
	...over,
});
const countdown = (over: Partial<Countdown> = {}): Countdown => ({
	deviceId: "d",
	sourceActionId: "a",
	startMs: NOW - 800,
	durationMs: 5000,
	endMode: "overtime",
	warn: false,
	...over,
});
const cd = (c: Countdown, now = NOW) => ({
	countdown: c,
	view: viewCountdown(c, now),
});

describe("buildFaceModel: clock mode", () => {
	test("24h defaults", () => {
		const m = buildFaceModel(NOW, cfg());
		expect(m).toMatchObject({
			mode: "clock",
			main: "16:59",
			prevMain: "16:58",
			mainAgeMs: 53250,
			sub: "53",
			prevSub: "52",
			subAgeMs: 250,
			date: "11-11",
			pm: false,
			step: 54,
			secAgeMs: 250,
			minuteAgeMs: 53250,
		});
		expect(m.fraction).toBeCloseTo(53.25 / 60, 10);
		expect(m.label).toBeUndefined();
		expect(m.countdown).toBeUndefined();
	});

	test("12h with pm indicator", () => {
		const m = buildFaceModel(NOW, cfg({ hour12: true, pmIndicator: true }));
		expect(m.main).toBe("04:59");
		expect(m.prevMain).toBe("04:58");
		expect(m.pm).toBe(true);
	});

	test("pm needs both 12h and the indicator, and an afternoon hour", () => {
		expect(buildFaceModel(NOW, cfg({ hour12: true })).pm).toBe(false);
		expect(buildFaceModel(NOW, cfg({ pmIndicator: true })).pm).toBe(false);
		const morning = new Date(2026, 10, 11, 9, 0, 0).getTime();
		expect(
			buildFaceModel(morning, cfg({ hour12: true, pmIndicator: true })).pm,
		).toBe(false);
	});

	test("showSeconds false -> no sub", () => {
		const m = buildFaceModel(NOW, cfg({ showSeconds: false }));
		expect(m.sub).toBeUndefined();
		expect(m.prevSub).toBeUndefined();
	});

	test("date only with showDate and only on classic", () => {
		expect(buildFaceModel(NOW, cfg({ showDate: false })).date).toBeUndefined();
		for (const face of ["modern", "line", "comet", "big"] as const) {
			expect(buildFaceModel(NOW, cfg({ face })).date).toBeUndefined();
		}
		expect(buildFaceModel(NOW, cfg({ dateFormat: "yy-mm-dd" })).date).toBe(
			"26-11-11",
		);
	});

	test("label is passed through, empty label is undefined", () => {
		expect(buildFaceModel(NOW, cfg({ label: "NYC" })).label).toBe("NYC");
		expect(buildFaceModel(NOW, cfg({ label: "" })).label).toBeUndefined();
	});

	test("prevMain across midnight and noon (12h)", () => {
		const midnight = new Date(2026, 10, 12, 0, 0, 10).getTime();
		expect(buildFaceModel(midnight, cfg()).prevMain).toBe("23:59");
		const one = new Date(2026, 10, 11, 13, 0, 0).getTime();
		const m = buildFaceModel(one, cfg({ hour12: true }));
		expect([m.main, m.prevMain]).toEqual(["01:00", "12:59"]);
	});

	test("minute boundary: fraction 0, first dot", () => {
		const m = buildFaceModel(new Date(2026, 10, 11, 17, 0, 0).getTime(), cfg());
		expect(m).toMatchObject({
			fraction: 0,
			step: 1,
			minuteAgeMs: 0,
			prevSub: "59",
		});
	});

	test("zone setting is respected", () => {
		const utc = Date.UTC(2026, 10, 11, 12, 0, 5, 250);
		const m = buildFaceModel(
			utc,
			cfg({ zone: { kind: "offset", minutes: -420 } }),
		);
		expect([m.main, m.sub]).toEqual(["05:00", "05"]);
	});
});

describe("buildFaceModel: countdown mode", () => {
	test("step is not pushed up by float noise", () => {
		// (31000 / 60000) * 60 = 31.000000000000004 in floating point
		const c = countdown({ startMs: NOW - 29000, durationMs: 60000 });
		expect(buildFaceModel(NOW, cfg(), cd(c)).step).toBe(31);
	});

	test("running 4200 of 5000 ms", () => {
		const m = buildFaceModel(NOW, cfg({ label: "NYC" }), cd(countdown()));
		expect(m).toMatchObject({
			mode: "countdown",
			main: "00:05",
			step: 51,
			pm: false,
			minuteAgeMs: 99999,
		});
		expect(m.fraction).toBeCloseTo(0.84, 10);
		expect(m.sub).toBeUndefined();
		expect(m.date).toBeUndefined();
		expect(m.label).toBeUndefined();
		expect(m.countdown?.phase).toBe("running");
	});

	test("running: previous digits and age since the digits changed", () => {
		const m = buildFaceModel(
			NOW,
			cfg(),
			cd(countdown({ startMs: NOW - 1800 })),
		);
		// remaining 3200 ms -> "00:04" since remaining hit 4000, i.e. 800 ms ago
		expect([m.main, m.prevMain]).toEqual(["00:04", "00:05"]);
		expect(m.mainAgeMs).toBe(800);
		expect(m.secAgeMs).toBe(800);
	});

	test("overtime", () => {
		const m = buildFaceModel(
			NOW,
			cfg(),
			cd(countdown({ startMs: NOW - 6300 })),
		);
		expect(m).toMatchObject({
			mode: "countdown",
			main: "+00:01",
			prevMain: "+00:00",
			mainAgeMs: 300,
			secAgeMs: 300,
			fraction: 0,
			step: 0,
		});
	});

	test("digit change with a different length does not roll", () => {
		// overtime +00:00 one second after 00:01: no positional roll between them
		const m = buildFaceModel(
			NOW,
			cfg(),
			cd(countdown({ startMs: NOW - 5300 })),
		);
		expect([m.main, m.prevMain]).toEqual(["+00:00", "+00:00"]);
	});

	test("hold and flash show 00:00 with the blink age", () => {
		const hold = buildFaceModel(
			NOW,
			cfg(),
			cd(countdown({ startMs: NOW - 7400, endMode: "hold" })),
		);
		expect(hold).toMatchObject({
			mode: "countdown",
			main: "00:00",
			prevMain: "00:00",
			mainAgeMs: 9999,
			secAgeMs: 400,
			fraction: 0,
			step: 0,
		});
		const flash = buildFaceModel(
			NOW,
			cfg(),
			cd(countdown({ startMs: NOW - 6100, endMode: "clock" })),
		);
		expect(flash).toMatchObject({ main: "00:00", secAgeMs: 100 });
		expect(flash.countdown?.phase).toBe("flash");
	});

	test("finished countdown shows the clock", () => {
		const m = buildFaceModel(
			NOW,
			cfg(),
			cd(countdown({ startMs: NOW - 9000, endMode: "clock" })),
		);
		expect(m.mode).toBe("clock");
		expect(m.main).toBe("16:59");
	});

	test("showCountdown false ignores the countdown", () => {
		const m = buildFaceModel(
			NOW,
			cfg({ showCountdown: false }),
			cd(countdown()),
		);
		expect(m.mode).toBe("clock");
		expect(m.main).toBe("16:59");
		expect(m.countdown).toBeUndefined();
	});
});
