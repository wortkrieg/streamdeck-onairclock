import { describe, expect, test } from "vitest";
import {
	ADJUST_DEFAULTS,
	CLOCK_DEFAULTS,
	COUNTDOWN_DEFAULTS,
	migrateV1,
	normalizeAdjust,
	normalizeClock,
	normalizeCountdown,
} from "./settings";

describe("normalizeClock", () => {
	test("time color follows the active color unless set apart", () => {
		const c = (raw: Record<string, unknown>) => normalizeClock(raw).colors;
		expect(c({ dotcolor: "#00FF00" }).time).toBe("#00FF00");
		expect(c({ dotcolor: "#00FF00", timeColor: "#FFFFFF" }).time).toBe(
			"#00FF00",
		);
		expect(
			c({ dotcolor: "#00FF00", separateTimeColor: true, timeColor: "#FFFFFF" }),
		).toMatchObject({ active: "#00FF00", time: "#FFFFFF" });
		expect(
			c({ dotcolor: "#00FF00", separateTimeColor: true, timeColor: "white" })
				.time,
		).toBe("#00FF00");
	});

	test("empty settings give defaults", () => {
		expect(normalizeClock({})).toEqual(CLOCK_DEFAULTS);
		expect(CLOCK_DEFAULTS).toEqual({
			face: "classic",
			showDate: true,
			showSeconds: true,
			dateFormat: "dd-mm",
			hour12: false,
			pmIndicator: false,
			colors: {
				active: "#FF3B2F",
				inactive: "#3D3D3D",
				background: "#000000",
				time: "#FF3B2F",
			},
			zone: { kind: "system" },
			label: "",
			animations: true,
			blinkColon: true,
			showCountdown: true,
		});
	});

	test("invalid values fall back to defaults", () => {
		expect(normalizeClock({ dotcolor: "red" }).colors.active).toBe("#FF3B2F");
		expect(normalizeClock({ dotcolor: "#abc" }).colors.active).toBe("#abc");
		expect(normalizeClock({ hourFormat: 12 }).hour12).toBe(true);
		expect(normalizeClock({ hourFormat: "12" }).hour12).toBe(true);
		expect(normalizeClock({ hourFormat: "24" }).hour12).toBe(false);
		expect(normalizeClock({ hourFormat: "x" }).hour12).toBe(false);
		expect(normalizeClock({ timezone: "Mars/Phobos" }).zone).toEqual({
			kind: "system",
		});
		expect(normalizeClock({ timezone: "fixed", utcOffset: "17" }).zone).toEqual(
			{ kind: "system" },
		);
		expect(normalizeClock({ timezone: "fixed" }).zone).toEqual({
			kind: "system",
		});
		expect(
			normalizeClock({ timezone: "fixed", utcOffset: "99999" }).zone,
		).toEqual({ kind: "system" });
		expect(normalizeClock({ label: "verylonglabel" }).label).toBe("VERYLO");
		expect(normalizeClock({ label: "  ab " }).label).toBe("AB");
		expect(normalizeClock({ label: 5 }).label).toBe("");
		expect(normalizeClock({ face: "nope" }).face).toBe("classic");
		expect(normalizeClock({ dateType: "yy-mm-dd" }).dateFormat).toBe(
			"yy-mm-dd",
		);
		expect(normalizeClock({ dateType: "zz" }).dateFormat).toBe("dd-mm");
	});

	test("zones", () => {
		expect(
			normalizeClock({ timezone: "fixed", utcOffset: "-420" }).zone,
		).toEqual({
			kind: "offset",
			minutes: -420,
		});
		expect(normalizeClock({ timezone: "America/Vancouver" }).zone).toEqual({
			kind: "iana",
			zone: "America/Vancouver",
		});
		expect(normalizeClock({ timezone: "system" }).zone).toEqual({
			kind: "system",
		});
	});

	test("booleans accept strings", () => {
		expect(normalizeClock({ ampmindicator: "true" }).pmIndicator).toBe(true);
		expect(normalizeClock({ ampmindicator: true }).pmIndicator).toBe(true);
		expect(normalizeClock({ ampmindicator: "false" }).pmIndicator).toBe(false);
		expect(normalizeClock({ showDate: "false" }).showDate).toBe(false);
		expect(normalizeClock({ animations: false }).animations).toBe(false);
		expect(normalizeClock({ blinkColon: "maybe" }).blinkColon).toBe(true);
	});
});

describe("migrateV1", () => {
	const cases: [string, string, boolean, boolean][] = [
		["0", "classic", true, true],
		["1", "classic", false, true],
		["2", "classic", true, false],
		["3", "classic", false, false],
		["7", "classic", true, true],
	];
	for (const [wf, face, showDate, showSeconds] of cases) {
		test(`watchface ${wf}`, () => {
			const input = { watchface: wf, mynameinput: "TEMPLATE" };
			const r = migrateV1(input);
			expect(r.changed).toBe(true);
			expect(r.settings.face).toBe(face);
			expect(r.settings.showDate).toBe(showDate);
			expect(r.settings.showSeconds).toBe(showSeconds);
			expect("watchface" in r.settings).toBe(false);
			expect("mynameinput" in r.settings).toBe(false);
			expect(input).toEqual({ watchface: wf, mynameinput: "TEMPLATE" });
		});
	}

	test("watchface 4 is modern", () => {
		const r = migrateV1({ watchface: "4" });
		expect(r.changed).toBe(true);
		expect(r.settings.face).toBe("modern");
		expect(r.settings.showDate).toBe(false);
		expect(r.settings.showSeconds).toBe(true);
		expect("watchface" in r.settings).toBe(false);
	});

	test("string boolean converted", () => {
		const r = migrateV1({ ampmindicator: "true" });
		expect(r.changed).toBe(true);
		expect(r.settings.ampmindicator).toBe(true);
	});

	test("already V2 is unchanged", () => {
		const r = migrateV1({ face: "line", showDate: false });
		expect(r.changed).toBe(false);
		expect(r.settings).toEqual({ face: "line", showDate: false });
	});

	test("face wins over watchface", () => {
		const r = migrateV1({ face: "line", watchface: "3" });
		expect(r.changed).toBe(true);
		expect(r.settings).toEqual({ face: "line" });
	});

	test("normalizeClock works on migrated output", () => {
		const c = normalizeClock(migrateV1({ watchface: "3" }).settings);
		expect(c.showDate).toBe(false);
		expect(c.showSeconds).toBe(false);
	});
});

describe("normalizeCountdown", () => {
	test("defaults", () => {
		expect(normalizeCountdown({})).toEqual(COUNTDOWN_DEFAULTS);
		expect(COUNTDOWN_DEFAULTS).toEqual({
			durationSec: 300,
			endMode: "overtime",
			warn: false,
			color: "#FF3B2F",
			adjustable: true,
		});
	});
	test("duration", () => {
		expect(normalizeCountdown({ duration: "5" }).durationSec).toBe(300);
		expect(normalizeCountdown({ duration: "99:59" }).durationSec).toBe(5999);
		expect(normalizeCountdown({ duration: "00:00" }).durationSec).toBe(300);
		expect(normalizeCountdown({ duration: "7:30" }).durationSec).toBe(450);
		expect(normalizeCountdown({ duration: "00:01" }).durationSec).toBe(1);
		expect(normalizeCountdown({ duration: "01:60" }).durationSec).toBe(300);
	});
	test("other fields", () => {
		expect(normalizeCountdown({ endMode: "hold" }).endMode).toBe("hold");
		expect(normalizeCountdown({ endMode: "clock" }).endMode).toBe("clock");
		expect(normalizeCountdown({ endMode: "x" }).endMode).toBe("overtime");
		expect(normalizeCountdown({ warn: "true" }).warn).toBe(true);
		expect(normalizeCountdown({ color: "#00ff00" }).color).toBe("#00ff00");
		expect(normalizeCountdown({ color: "green" }).color).toBe("#FF3B2F");
	});
});

describe("countdown keys and the + and − keys", () => {
	test("countdown keys follow + and − unless switched off", () => {
		expect(normalizeCountdown({}).adjustable).toBe(true);
		expect(normalizeCountdown({ adjustable: false }).adjustable).toBe(false);
		expect(normalizeCountdown({ adjustable: "false" }).adjustable).toBe(false);
	});

	test("the step defaults to one minute", () => {
		expect(ADJUST_DEFAULTS).toEqual({ stepSec: 60, color: "#FF3B2F" });
		expect(normalizeAdjust({})).toEqual(ADJUST_DEFAULTS);
	});

	test("the step counts minutes, or seconds with the checkbox", () => {
		expect(normalizeAdjust({ step: "5" }).stepSec).toBe(300);
		expect(normalizeAdjust({ step: "10", seconds: true }).stepSec).toBe(10);
		expect(normalizeAdjust({ step: "10", seconds: "true" }).stepSec).toBe(10);
		expect(normalizeAdjust({ step: " 15 ", seconds: true }).stepSec).toBe(15);
		expect(normalizeAdjust({ step: 2 }).stepSec).toBe(120);
		expect(normalizeAdjust({ step: "99" }).stepSec).toBe(5940);
	});

	test("an invalid step falls back to 1", () => {
		for (const step of ["0", "100", "-5", "1.5", "abc", "", null, 0])
			expect(
				normalizeAdjust({ step, seconds: true }).stepSec,
				String(step),
			).toBe(1);
	});

	test("the + and − keys take a color", () => {
		expect(normalizeAdjust({ color: "#00ff00" }).color).toBe("#00ff00");
		expect(normalizeAdjust({ color: "green" }).color).toBe("#FF3B2F");
	});
});
