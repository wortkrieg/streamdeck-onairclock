import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const ui = (file: string): string =>
	fileURLToPath(
		new URL(`../../fail.marc.onairclock.sdPlugin/ui/${file}`, import.meta.url),
	);

/** sdpi-components v4.0.1, vendored from GeekyEggo/sdpi-components tag v4.0.1 (dist/). */
const SDPI_SHA256 =
	"f6c0dfd2ed68e18084b9952842b86e3850cf837d674704700c2a0718e0a24f6b";

describe("property inspectors work offline", () => {
	for (const page of ["clock.html", "countdown.html", "adjust.html"]) {
		test(`${page} loads the vendored sdpi-components and nothing remote`, () => {
			const html = readFileSync(ui(page), "utf8");
			const srcs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]*)"/g)].map(
				([, src]) => src,
			);
			expect(srcs).toEqual(["sdpi-components.js"]);
			expect(html).not.toMatch(/<script\b[^>]*\bsrc="https?:\/\//);
		});
	}

	test("the vendored file is sdpi-components 4.0.1 with its license header", () => {
		const js = readFileSync(ui("sdpi-components.js"));
		expect(js.subarray(0, 300).toString("utf8")).toContain(
			"@license\n* sdpi-components v4.0.1, Copyright Corsair Memory Inc.",
		);
		expect(createHash("sha256").update(js).digest("hex")).toBe(SDPI_SHA256);
	});
});
