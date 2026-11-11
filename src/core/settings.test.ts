import { describe, expect, test } from "vitest";
import {
	CLOCK_DEFAULTS,
	COUNTDOWN_DEFAULTS,
	migrateV1,
	normalizeClock,
	normalizeCountdown,
} from "./settings";

describe("normalizeClock", () => {
	test("empty settings give defaults", () => {
		expect(normalizeClock({})).toEqual(CLOCK_DEFAULTS);
		expect(CLOCK_DEFAULTS).toEqual({
			face: "classic",
			showDate: true,
			showSeconds: true,
			dateFormat: "dd-mm",
			hour12: false,
			pmIndicator: false,
			colors: { active: "#FF3B2F", inactive: "#3D3D3D", background: "#000000" },
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
