import { describe, expect, test, vi } from "vitest";
import { LOG_WINDOW_MS, ThrottledLog } from "./throttled-log";

describe("ThrottledLog", () => {
	test("logs at most once per key and 10 s window", () => {
		const log = vi.fn();
		const t = new ThrottledLog(log);
		t.warn("a", "a1", 0);
		t.warn("a", "a2", 100);
		t.warn("b", "b1", 100);
		t.warn("a", "a3", LOG_WINDOW_MS - 1);
		t.warn("a", "a4", LOG_WINDOW_MS);
		expect(log.mock.calls.map(([m]) => m)).toEqual([
			"a1",
			"b1",
			"a4 (2 similar suppressed)",
		]);
		expect(LOG_WINDOW_MS).toBe(10_000);
	});

	test("a clock that jumps back starts a new window", () => {
		const log = vi.fn();
		const t = new ThrottledLog(log);
		t.warn("a", "first", 50_000);
		t.warn("a", "after the jump", 20_000);
		expect(log).toHaveBeenCalledTimes(2);
	});
});
