import { describe, expect, test } from "vitest";
import { renderAdjustKey } from "./adjust-key";
import { renderCountdownKey } from "./countdown-key";

const RED = "#FF3B2F";

describe("renderAdjustKey", () => {
	test("plus and minus differ only in the sign", () => {
		const plus = renderAdjustKey("plus", 60, RED);
		const minus = renderAdjustKey("minus", 60, RED);
		expect(plus).not.toBe(minus);
		const sign = /<path d="[^"]*" class="sign"[^>]*\/>/;
		expect(plus.replace(sign, "")).toBe(minus.replace(sign, ""));
	});

	test("shows the step in the countdown key's digits", () => {
		// Same digits, size and place as an idle countdown key of that duration.
		const digits = (svg: string) =>
			/<g [^>]*stroke-linecap[\s\S]*?<\/g>/.exec(svg)?.[0];
		expect(digits(renderAdjustKey("plus", 10, RED))).toBe(
			digits(renderCountdownKey(null, 10, RED)),
		);
		expect(renderAdjustKey("plus", 10, RED)).not.toBe(
			renderAdjustKey("plus", 600, RED),
		);
	});

	test("draws in the key's color", () => {
		expect(renderAdjustKey("minus", 60, "#00FF00")).toContain("#00FF00");
		expect(renderAdjustKey("minus", 60, "#00FF00")).not.toContain(RED);
	});
});
