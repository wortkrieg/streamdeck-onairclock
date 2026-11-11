import { describe, expect, test } from "vitest";
import { arcPath, polar } from "./geometry";

describe("polar", () => {
	test("0 is 12 o'clock", () => {
		const [x, y] = polar(50, 0);
		expect(x).toBeCloseTo(72);
		expect(y).toBeCloseTo(22);
	});
	test("0.25 is 3 o'clock", () => {
		const [x, y] = polar(50, 0.25);
		expect(x).toBeCloseTo(122);
		expect(y).toBeCloseTo(72);
	});
});

describe("arcPath", () => {
	test("empty for zero-length arcs", () => {
		expect(arcPath(61, 0, 0)).toBe("");
		expect(arcPath(61, 0.3, 0.3004)).toBe("");
	});
	test("full circle uses two arcs", () => {
		expect(arcPath(61, 0, 1).match(/A/g)).toHaveLength(2);
		expect(arcPath(61, 0, 0.9995).match(/A/g)).toHaveLength(2);
	});
	test("large-arc flag", () => {
		expect(arcPath(61, 0, 0.75)).toMatch(/A61 61 0 1 1 /);
		expect(arcPath(61, 0, 0.25)).toMatch(/A61 61 0 0 1 /);
	});
	test("starts at 12 o'clock for fraction 0", () => {
		expect(arcPath(61, 0, 0.25)).toBe("M72 11A61 61 0 0 1 133 72");
	});
});
