import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { buildFaceModel } from "../core/clock-model";
import { formatOffset } from "../core/format";
import {
	CLOCK_DEFAULTS,
	type ClockConfig,
	type ClockSettingsStored,
	type FaceId,
} from "../core/settings";
import { OFFSET_STEPS } from "../core/time";
import { renderFace, STATIC_ANIM } from "../render/faces";

const html = readFileSync(
	fileURLToPath(
		new URL(
			"../../fail.marc.onairclock.sdPlugin/ui/clock.html",
			import.meta.url,
		),
	),
	"utf8",
);

/** Every stored key; `Required` makes the compiler insist on all of them. */
const STORED: Required<ClockSettingsStored> = {
	face: CLOCK_DEFAULTS.face,
	showDate: CLOCK_DEFAULTS.showDate,
	showSeconds: CLOCK_DEFAULTS.showSeconds,
	dateType: CLOCK_DEFAULTS.dateFormat,
	hourFormat: CLOCK_DEFAULTS.hour12 ? "12" : "24",
	ampmindicator: CLOCK_DEFAULTS.pmIndicator,
	dotcolor: CLOCK_DEFAULTS.colors.active,
	inactivecolor: CLOCK_DEFAULTS.colors.inactive,
	backgroundcolor: CLOCK_DEFAULTS.colors.background,
	timezone: "system",
	utcOffset: "0",
	label: CLOCK_DEFAULTS.label,
	animations: CLOCK_DEFAULTS.animations,
	blinkColon: CLOCK_DEFAULTS.blinkColon,
	showCountdown: CLOCK_DEFAULTS.showCountdown,
};

/** setting -> { tag, default } for every sdpi input in the PI. */
const inputs = new Map(
	[...html.matchAll(/<sdpi-(\w+)\b([^>]*)>/g)].flatMap(([, tag, attrs]) => {
		const setting = /\bsetting="([^"]+)"/.exec(attrs ?? "")?.[1];
		const def = /\bdefault="([^"]*)"/.exec(attrs ?? "")?.[1];
		return setting ? [[setting, { tag, def }] as const] : [];
	}),
);

describe("ui/clock.html", () => {
	test("uses exactly the stored setting keys", () => {
		expect([...inputs.keys()].sort()).toEqual(Object.keys(STORED).sort());
	});

	test("defaults match CLOCK_DEFAULTS", () => {
		for (const [key, value] of Object.entries(STORED)) {
			const input = inputs.get(key);
			if (input?.tag === "checkbox") {
				// sdpi reads any default attribute as truthy, so false means "no attribute".
				expect(input.def, key).toBe(value ? "true" : undefined);
			} else if (key === "label") {
				expect(input?.def, key).toBeUndefined();
			} else {
				expect(input?.def, key).toBe(value);
			}
		}
	});

	test("UTC offset options are OFFSET_STEPS labelled with formatOffset", () => {
		const select =
			/<sdpi-select[^>]*setting="utcOffset"[^>]*>([\s\S]*?)<\/sdpi-select>/.exec(
				html,
			)?.[1];
		const options = [
			...(select ?? "").matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g),
		].map(([, value, label]) => [value, label]);
		expect(options).toEqual(
			OFFSET_STEPS.map((m) => [String(m), formatOffset(m)]),
		);
	});

	test("label is limited to 6 characters", () => {
		expect(html).toMatch(
			/<sdpi-textfield[^>]*setting="label"[^>]*maxlength="6"/,
		);
	});

	test("face-specific options say which faces they apply to", () => {
		expect(hintFor("showDate")).toBe("Only Classic shows the date.");
		expect(hintFor("showSeconds")).toBe(
			"Seconds digits on Classic, Modern Minimal and Line.",
		);
		expect(hintFor("label")).toBe(
			"Shown on Classic (instead of the date), Modern Minimal and Line.",
		);
	});

	test("the hints match what the faces draw", () => {
		const nowMs = Date.UTC(2026, 10, 11, 9, 8, 30);
		const svg = (face: FaceId, over: Partial<ClockConfig>) => {
			const cfg = { ...CLOCK_DEFAULTS, face, ...over };
			const m = buildFaceModel(nowMs, cfg);
			return renderFace(face, m, cfg.colors, STATIC_ANIM);
		};
		const faces = (shows: (face: FaceId) => boolean) => FACES.filter(shows);
		expect(
			faces((f) => svg(f, { showDate: true }) !== svg(f, { showDate: false })),
		).toEqual(["classic"]);
		expect(
			faces(
				(f) => svg(f, { showSeconds: true }) !== svg(f, { showSeconds: false }),
			),
		).toEqual(["classic", "modern", "line"]);
		expect(faces((f) => svg(f, { label: "NYC" }).includes(">NYC<"))).toEqual([
			"classic",
			"modern",
			"line",
		]);
	});
});

const FACES: FaceId[] = ["classic", "modern", "line", "comet", "big"];

/** The hint line inside the sdpi-item that holds `setting`. */
function hintFor(setting: string): string | undefined {
	const item = [...html.matchAll(/<sdpi-item\b[^>]*>([\s\S]*?)<\/sdpi-item>/g)]
		.map(([, body]) => body ?? "")
		.find((body) => body.includes(`setting="${setting}"`));
	return /<p class="hint">([^<]*)<\/p>/.exec(item ?? "")?.[1];
}
