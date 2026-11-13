import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { formatMMSS } from "../core/format";
import {
	ADJUST_DEFAULTS,
	type AdjustSettingsStored,
	COUNTDOWN_DEFAULTS,
	type CountdownSettingsStored,
	normalizeAdjust,
} from "../core/settings";

const read = (file: string): string =>
	readFileSync(
		fileURLToPath(
			new URL(
				`../../fail.marc.onairclock.sdPlugin/ui/${file}`,
				import.meta.url,
			),
		),
		"utf8",
	);

/** setting -> { tag, default, pattern } for every sdpi input in a PI. */
function inputs(html: string) {
	return new Map(
		[...html.matchAll(/<sdpi-(\w+)\b([^>]*)>/g)].flatMap(([, tag, attrs]) => {
			const attr = (name: string) =>
				new RegExp(`\\b${name}="([^"]*)"`).exec(attrs ?? "")?.[1];
			const setting = attr("setting");
			return setting
				? [
						[
							setting,
							{ tag, def: attr("default"), pattern: attr("pattern") },
						] as const,
					]
				: [];
		}),
	);
}

/** sdpi reads any default attribute on a checkbox as truthy, so false means "no attribute". */
function expectDefaults(
	found: ReturnType<typeof inputs>,
	stored: Record<string, string | boolean>,
) {
	expect([...found.keys()].sort()).toEqual(Object.keys(stored).sort());
	for (const [key, value] of Object.entries(stored)) {
		const input = found.get(key);
		if (input?.tag === "checkbox")
			expect(input.def, key).toBe(value ? "true" : undefined);
		else expect(input?.def, key).toBe(value);
	}
}

describe("ui/countdown.html", () => {
	const STORED: Required<CountdownSettingsStored> = {
		duration: formatMMSS(COUNTDOWN_DEFAULTS.durationSec),
		endMode: COUNTDOWN_DEFAULTS.endMode,
		warn: COUNTDOWN_DEFAULTS.warn,
		color: COUNTDOWN_DEFAULTS.color,
		adjustable: COUNTDOWN_DEFAULTS.adjustable,
	};

	test("uses exactly the stored setting keys with their defaults", () => {
		expectDefaults(inputs(read("countdown.html")), STORED);
	});
});

describe("ui/adjust.html", () => {
	const STORED: Required<AdjustSettingsStored> = {
		step: String(ADJUST_DEFAULTS.stepSec / 60),
		seconds: false,
		color: ADJUST_DEFAULTS.color,
	};
	const found = inputs(read("adjust.html"));

	test("uses exactly the stored setting keys with their defaults", () => {
		expectDefaults(found, STORED);
	});

	test("the step field accepts exactly the steps the plugin takes", () => {
		const pattern = new RegExp(found.get("step")?.pattern ?? "(?!)");
		for (let n = 0; n <= 120; n++) {
			const accepted = pattern.test(String(n));
			expect(accepted, String(n)).toBe(
				normalizeAdjust({ step: String(n), seconds: true }).stepSec === n,
			);
		}
		expect(pattern.test("abc")).toBe(false);
	});
});
