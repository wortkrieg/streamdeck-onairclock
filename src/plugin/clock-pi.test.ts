import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { formatOffset } from "../core/format";
import { CLOCK_DEFAULTS, type ClockSettingsStored } from "../core/settings";
import { OFFSET_STEPS } from "../core/time";

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
});
