import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { KeyRepeater, REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from "./key-repeat";

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

test("steps once on press, then repeats while the key is held", () => {
	const r = new KeyRepeater();
	const step = vi.fn(() => true);
	r.start("k", step);
	expect(step).toHaveBeenCalledTimes(1);
	vi.advanceTimersByTime(REPEAT_DELAY_MS - 1);
	expect(step).toHaveBeenCalledTimes(1);
	vi.advanceTimersByTime(1);
	expect(step).toHaveBeenCalledTimes(2);
	vi.advanceTimersByTime(REPEAT_INTERVAL_MS * 3);
	expect(step).toHaveBeenCalledTimes(5);
	r.stop("k");
	vi.advanceTimersByTime(10_000);
	expect(step).toHaveBeenCalledTimes(5);
});

test("a step that finds nothing to change ends the repeat", () => {
	const r = new KeyRepeater();
	const step = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
	r.start("k", step);
	vi.advanceTimersByTime(10_000);
	expect(step).toHaveBeenCalledTimes(2);
});

test("keys repeat independently and a new press restarts the delay", () => {
	const r = new KeyRepeater();
	const a = vi.fn(() => true);
	const b = vi.fn(() => true);
	r.start("a", a);
	r.start("b", b);
	r.stop("a");
	vi.advanceTimersByTime(REPEAT_DELAY_MS);
	expect(a).toHaveBeenCalledTimes(1);
	expect(b).toHaveBeenCalledTimes(2);
	r.start("b", b);
	expect(b).toHaveBeenCalledTimes(3);
	vi.advanceTimersByTime(REPEAT_DELAY_MS - 1);
	expect(b).toHaveBeenCalledTimes(3);
	r.stop("b");
	r.stop("unknown");
});

test("a repeated step that throws is reported and ends the repeat", () => {
	const onError = vi.fn();
	const r = new KeyRepeater(onError);
	const step = vi
		.fn()
		.mockReturnValueOnce(true)
		.mockImplementation(() => {
			throw new Error("boom");
		});
	r.start("k", step);
	vi.advanceTimersByTime(10_000);
	expect(step).toHaveBeenCalledTimes(2);
	expect(onError).toHaveBeenCalledWith(expect.any(Error));
});
