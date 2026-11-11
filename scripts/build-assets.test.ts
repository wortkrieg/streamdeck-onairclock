import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { BRAND, buildAssets } from "./build-assets";

const PLUGIN = "fail.marc.onairclock.sdPlugin";
const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const PNG_SIZES: ReadonlyArray<[string, number, number]> = [
	[`${PLUGIN}/imgs/plugin/icon.png`, 256, 256],
	[`${PLUGIN}/imgs/plugin/icon@2x.png`, 512, 512],
	[`${PLUGIN}/imgs/actions/clock/key.png`, 72, 72],
	[`${PLUGIN}/imgs/actions/clock/key@2x.png`, 144, 144],
	[`${PLUGIN}/imgs/actions/clock/encoder.png`, 72, 72],
	[`${PLUGIN}/imgs/actions/clock/encoder@2x.png`, 144, 144],
	[`${PLUGIN}/imgs/actions/countdown/key.png`, 72, 72],
	[`${PLUGIN}/imgs/actions/countdown/key@2x.png`, 144, 144],
	["marketing/marketplace-icon.png", 288, 288],
	["marketing/gallery-1-hero.png", 1920, 960],
	["marketing/gallery-2-faces.png", 1920, 960],
	["marketing/gallery-3-timezones.png", 1920, 960],
	["marketing/gallery-4-countdown.png", 1920, 960],
	["marketing/social-preview.png", 1280, 640],
];

const WHITE_SVGS = [
	`${PLUGIN}/imgs/plugin/category.svg`,
	`${PLUGIN}/imgs/actions/clock/icon.svg`,
	`${PLUGIN}/imgs/actions/countdown/icon.svg`,
];

let out = "";

beforeAll(async () => {
	out = mkdtempSync(join(tmpdir(), "onair-assets-"));
	await buildAssets(out);
}, 120_000);

afterAll(() => {
	if (out) rmSync(out, { recursive: true, force: true });
});

function pngSize(file: string): [number, number] {
	const bytes = readFileSync(join(out, file));
	expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
	// IHDR is the first chunk: width and height at byte 16 and 20.
	return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe("buildAssets", () => {
	test.each(PNG_SIZES)("%s is %i x %i", (file, width, height) => {
		expect(pngSize(file)).toEqual([width, height]);
	});

	test.each(WHITE_SVGS)("%s is monochrome white", (file) => {
		const svg = readFileSync(join(out, file), "utf8");
		const paints = [
			...svg.matchAll(
				/(?:fill|stroke|stop-color|color)\s*[=:]\s*"?([^";\s>]+)/g,
			),
		].map((m) => (m[1] ?? "").toLowerCase());
		expect(paints.length).toBeGreaterThan(0);
		for (const paint of paints)
			expect(["#ffffff", "white", "none"]).toContain(paint);
		for (const hex of svg.match(/#[0-9a-f]{3,8}\b/gi) ?? [])
			expect(hex.toUpperCase()).toBe("#FFFFFF");
		expect(svg).not.toMatch(/opacity/);
	});

	test("README images exist: hero PNG and an animated GIF", () => {
		const [w, h] = pngSize("docs/images/readme-hero.png");
		expect(w).toBeGreaterThanOrEqual(1200);
		expect(w / h).toBeGreaterThanOrEqual(2);
		const gif = readFileSync(join(out, "docs/images/readme-demo.gif"));
		expect(gif.subarray(0, 6).toString("latin1")).toBe("GIF89a");
	});
});

describe("manifest branding", () => {
	test("the Stream Deck+ encoder stack color is the brand ultramarine", () => {
		const manifest = JSON.parse(
			readFileSync(
				fileURLToPath(new URL(`../${PLUGIN}/manifest.json`, import.meta.url)),
				"utf8",
			),
		) as { Actions: { UUID: string; Encoder?: { StackColor?: string } }[] };
		const clock = manifest.Actions.find(
			(a) => a.UUID === "fail.marc.onairclock.action",
		);
		expect(clock?.Encoder?.StackColor).toBe(BRAND.ultramarine);
	});
});
