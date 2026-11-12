import { describe, expect, test } from "vitest";
import { svgDocument, toDataUri, toDataUriWith } from "./svg";

describe("svgDocument", () => {
	test("wraps with background rect", () => {
		expect(svgDocument("<g/>", "#000")).toBe(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144"><rect width="144" height="144" fill="#000"/><g/></svg>',
		);
	});
	test("omits rect for none", () => {
		expect(svgDocument("<g/>", "none")).not.toContain("<rect");
	});
});

describe("toDataUri", () => {
	test("current format is base64", () => {
		expect(toDataUri("<svg/>").startsWith("data:image/svg+xml;base64,")).toBe(
			true,
		);
	});
	test("formats", () => {
		expect(toDataUriWith("<svg/>", "base64")).toBe(
			`data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`,
		);
		expect(toDataUriWith("<svg a='#'/>", "utf8")).toBe(
			"data:image/svg+xml;charset=utf8,<svg a='#'/>",
		);
		expect(toDataUriWith("<svg a='#'/>", "uri")).toBe(
			`data:image/svg+xml;charset=utf8,${encodeURIComponent("<svg a='#'/>")}`,
		);
	});
});
