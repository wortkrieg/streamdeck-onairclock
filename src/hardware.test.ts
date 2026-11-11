import { expect, test } from "vitest";
import { FAST_FPS } from "./hardware";

test("FAST_FPS is within the planned bounds", () => {
	expect(FAST_FPS).toBeGreaterThanOrEqual(4);
	expect(FAST_FPS).toBeLessThanOrEqual(15);
});
