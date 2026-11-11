import { describe, expect, test } from "vitest";
import {
	displayHour,
	formatDate,
	formatMMSS,
	formatOffset,
	isPm,
	pad2,
} from "./format";
import type { WallTime } from "./time";

const t: WallTime = {
	year: 2026,
	month: 11,
	day: 5,
	hour: 0,
	minute: 0,
	second: 0,
	ms: 0,
};

describe("format", () => {
	test("pad2", () => {
		expect(pad2(5)).toBe("05");
		expect(pad2(12)).toBe("12");
	});
	test("formatDate", () => {
		expect(formatDate(t, "dd-mm")).toBe("05-11");
		expect(formatDate(t, "mm-dd")).toBe("11-05");
		expect(formatDate(t, "dd-mm-yy")).toBe("05-11-26");
		expect(formatDate(t, "mm-dd-yy")).toBe("11-05-26");
		expect(formatDate(t, "yy-mm-dd")).toBe("26-11-05");
	});
	test("displayHour", () => {
		expect(displayHour(0, true)).toBe(12);
		expect(displayHour(12, true)).toBe(12);
		expect(displayHour(13, true)).toBe(1);
		expect(displayHour(13, false)).toBe(13);
	});
	test("isPm", () => {
		expect(isPm(11)).toBe(false);
		expect(isPm(12)).toBe(true);
	});
	test("formatMMSS", () => {
		expect(formatMMSS(300)).toBe("05:00");
		expect(formatMMSS(6000)).toBe("99:59");
		expect(formatMMSS(-3)).toBe("00:00");
		expect(formatMMSS(Number.NaN)).toBe("00:00");
		expect(formatMMSS(Number.POSITIVE_INFINITY)).toBe("99:59");
	});
	test("formatOffset", () => {
		expect(formatOffset(-420)).toBe("UTC−07:00");
		expect(formatOffset(345)).toBe("UTC+05:45");
		expect(formatOffset(0)).toBe("UTC+00:00");
	});
});
