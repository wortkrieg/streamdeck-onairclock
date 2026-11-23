import { describe, expect, test } from "vitest";
import { homography, project } from "./build-device-media";

describe("homography", () => {
	const src = [
		[0, 0],
		[100, 0],
		[0, 50],
		[100, 50],
	] as const;
	const dst = [
		[1438, 1255],
		[4700, 1255],
		[1368, 2777],
		[4760, 2777],
	] as const;

	test("sends the four corners to the four target points", () => {
		const h = homography(src, dst);
		src.forEach((p, i) => {
			const [x, y] = project(h, p);
			expect(x).toBeCloseTo(dst[i]?.[0] ?? Number.NaN, 6);
			expect(y).toBeCloseTo(dst[i]?.[1] ?? Number.NaN, 6);
		});
	});

	test("keeps straight lines straight: the top edge's midpoint stays on it", () => {
		const [, y] = project(homography(src, dst), [50, 0]);
		expect(y).toBeCloseTo(1255, 6);
	});

	test("is the identity for identical point sets", () => {
		const [x, y] = project(homography(src, src), [37, 21]);
		expect(x).toBeCloseTo(37, 9);
		expect(y).toBeCloseTo(21, 9);
	});
});
