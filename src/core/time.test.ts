import { describe, expect, test } from "vitest";
import { isValidIanaZone, OFFSET_STEPS, wallTime } from "./time";

describe("wallTime", () => {
	test("fixed offset", () => {
		expect(
			wallTime(Date.UTC(2026, 10, 11, 12, 0, 5, 250), {
				kind: "offset",
				minutes: -420,
			}),
		).toEqual({
			year: 2026,
			month: 11,
			day: 11,
			hour: 5,
			minute: 0,
			second: 5,
			ms: 250,
		});
	});

	test("iana Europe/Berlin across DST end", () => {
		const z = { kind: "iana", zone: "Europe/Berlin" } as const;
		const a = wallTime(Date.UTC(2026, 9, 25, 0, 59, 59), z);
		expect([a.hour, a.minute, a.second]).toEqual([2, 59, 59]);
		const b = wallTime(Date.UTC(2026, 9, 25, 1, 0, 0), z);
		expect([b.hour, b.minute, b.second]).toEqual([2, 0, 0]);
	});

	test("iana Asia/Kathmandu", () => {
		const t = wallTime(Date.UTC(2026, 10, 11, 12, 0, 0), {
			kind: "iana",
			zone: "Asia/Kathmandu",
		});
		expect([t.hour, t.minute]).toEqual([17, 45]);
	});

	test("midnight is hour 0, not 24", () => {
		const t = wallTime(Date.UTC(2026, 10, 11, 23, 30, 0), {
			kind: "iana",
			zone: "Europe/Berlin",
		});
		expect([t.day, t.hour, t.minute]).toEqual([12, 0, 30]);
	});

	test("invalid iana zone falls back to system without throwing", () => {
		const ms = Date.UTC(2026, 5, 1, 10, 20, 30, 123);
		const bad = { kind: "iana", zone: "Mars/Phobos" } as const;
		expect(wallTime(ms, bad)).toEqual(wallTime(ms, { kind: "system" }));
		expect(wallTime(ms, bad)).toEqual(wallTime(ms, { kind: "system" }));
	});

	test("system matches Date getters", () => {
		const ms = Date.UTC(2026, 5, 1, 10, 20, 30, 123);
		const d = new Date(ms);
		expect(wallTime(ms, { kind: "system" })).toEqual({
			year: d.getFullYear(),
			month: d.getMonth() + 1,
			day: d.getDate(),
			hour: d.getHours(),
			minute: d.getMinutes(),
			second: d.getSeconds(),
			ms: 123,
		});
	});
});

describe("isValidIanaZone", () => {
	test("accepts and rejects", () => {
		expect(isValidIanaZone("Europe/Berlin")).toBe(true);
		expect(isValidIanaZone("Mars/Phobos")).toBe(false);
	});
});

describe("OFFSET_STEPS", () => {
	test("range", () => {
		expect(OFFSET_STEPS.length).toBe(105);
		expect(OFFSET_STEPS[0]).toBe(-720);
		expect(OFFSET_STEPS[104]).toBe(840);
	});
});
