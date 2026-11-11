import { describe, expect, test } from "vitest";
import { fitHeight, GLYPHS, renderDigits, textUnits } from "./digits";

const base = { cx: 72, cy: 72, height: 48, stroke: 4, color: "#fff" };
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe("renderDigits", () => {
	test("glyph table covers digits, minus and plus", () => {
		for (const c of "0123456789-+") expect(GLYPHS[c]).toBeTruthy();
	});
	test("12:34 -> 4 paths, 2 circles", () => {
		const s = renderDigits("12:34", base);
		expect(count(s, "<path")).toBe(4);
		expect(count(s, "<circle")).toBe(2);
		expect(s.startsWith("<g")).toBe(true);
		expect(s.endsWith("</g>")).toBe(true);
	});
	test("roll: changed glyph drawn twice", () => {
		const s = renderDigits("12:34", { ...base, prev: "12:33", progress: 0.5 });
		expect(count(s, "<path")).toBe(5);
	});
	test("progress 1 draws each glyph once", () => {
		expect(
			count(
				renderDigits("12:34", { ...base, prev: "12:33", progress: 1 }),
				"<path",
			),
		).toBe(4);
	});
	test("no prev draws once", () => {
		expect(
			count(renderDigits("12:34", { ...base, progress: 0.3 }), "<path"),
		).toBe(4);
	});
	test("unknown characters are skipped", () => {
		expect(count(renderDigits("A1", base), "<path")).toBe(1);
		expect(renderDigits("A1", base)).toBe(renderDigits("1", base));
	});
	test("colonOpacity", () => {
		expect(renderDigits("1:2", { ...base, colonOpacity: 0.2 })).toContain(
			'opacity="0.2"',
		);
	});
	test("roll uses ease-out-cubic offsets", () => {
		const s = renderDigits("1", { ...base, prev: "2", progress: 0.5 });
		// e = 0.875 -> old at -7.875 -> -7.87, new at +1.125 -> 1.13
		expect(s).toContain("translate(-5 -7.87)");
		expect(s).toContain("translate(-5 1.13)");
		expect(s).toContain('opacity="0.13"');
		expect(s).toContain('opacity="0.88"');
	});
});

describe("fitHeight", () => {
	test("short text keeps the maximum height", () => {
		expect(fitHeight("20:48", 28, 106, 4.2)).toBe(28);
	});
	test("long text shrinks until it fits the width", () => {
		const h = fitHeight("+00:12", 28, 106, 4.2);
		expect(h).toBeLessThan(28);
		expect((textUnits("+00:12") * h) / 16 + 4.2).toBeCloseTo(106, 6);
	});
	test("unknown characters take no width", () => {
		expect(textUnits("1x2")).toBe(textUnits("12"));
		expect(fitHeight("", 20, 10, 2)).toBe(20);
	});
});
