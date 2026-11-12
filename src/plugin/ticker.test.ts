import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { combineFrames, type FrameResult, Ticker } from "./ticker";

/** 2026-11-11 12:00:00.250 UTC: a quarter second past a full second. */
const T0 = Date.UTC(2026, 10, 11, 12, 0, 0) + 250;
const SLOW: FrameResult = { fast: false, phasesMs: [0] };

/** A frame function that records the times it was called at. */
function recorder(result: FrameResult = SLOW) {
	const times: number[] = [];
	const frame = vi.fn((nowMs: number) => {
		times.push(nowMs);
		return result;
	});
	return { times, frame };
}

const diffs = (xs: number[]): number[] =>
	xs.slice(1).map((x, i) => x - (xs[i] ?? Number.NaN));

beforeEach(() => {
	vi.useFakeTimers({ now: T0 });
});
afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("Ticker", () => {
	test("calls frame at second boundaries", () => {
		const { times, frame } = recorder();
		const t = new Ticker(frame, 10);
		t.start();
		vi.advanceTimersByTime(5000);
		t.stop();
		expect(times).toHaveLength(5);
		for (const now of times) expect(now % 1000).toBeLessThan(20);
		expect(diffs(times)).toEqual([1000, 1000, 1000, 1000]);
	});

	test("does not call frame before the first boundary", () => {
		const { frame } = recorder();
		new Ticker(frame, 10).start();
		vi.advanceTimersByTime(700);
		expect(frame).not.toHaveBeenCalled();
	});

	test("fast: true spaces frames 1000/fastFps apart", () => {
		const { times, frame } = recorder({ fast: true, phasesMs: [0] });
		const t = new Ticker(frame, 10);
		t.start();
		vi.advanceTimersByTime(2000);
		t.stop();
		expect(times.length).toBeGreaterThan(10);
		for (const d of diffs(times)) expect(d).toBe(100);

		const slower = recorder({ fast: true, phasesMs: [0] });
		const t4 = new Ticker(slower.frame, 4);
		t4.start();
		vi.advanceTimersByTime(2000);
		t4.stop();
		for (const d of diffs(slower.times)) expect(d).toBe(250);
	});

	test("stop prevents further calls, also when called from inside frame", () => {
		const { frame } = recorder();
		const t = new Ticker(frame, 10);
		t.start();
		vi.advanceTimersByTime(2500);
		const calls = frame.mock.calls.length;
		t.stop();
		vi.advanceTimersByTime(5000);
		expect(frame).toHaveBeenCalledTimes(calls);
		expect(vi.getTimerCount()).toBe(0);

		let n = 0;
		const ticker: Ticker = new Ticker(() => {
			n++;
			ticker.stop();
			return SLOW;
		}, 10);
		ticker.start();
		vi.advanceTimersByTime(5000);
		expect(n).toBe(1);
		expect(vi.getTimerCount()).toBe(0);
	});

	test("keeps running with delays in [10, 1010] when the clock jumps +3 h and -10 min", () => {
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
		const { frame } = recorder({ fast: false, phasesMs: [0, 250, 500] });
		const t = new Ticker(frame, 10);
		t.start();
		vi.advanceTimersByTime(2000);
		const beforeJump = frame.mock.calls.length;

		vi.setSystemTime(Date.now() + 3 * 3600_000 + 137);
		vi.advanceTimersByTime(3000);
		const afterForward = frame.mock.calls.length;

		vi.setSystemTime(Date.now() - 10 * 60_000 - 411);
		vi.advanceTimersByTime(3000);
		const afterBackward = frame.mock.calls.length;
		t.stop();

		expect(beforeJump).toBeGreaterThan(0);
		expect(afterForward - beforeJump).toBeGreaterThanOrEqual(3);
		expect(afterBackward - afterForward).toBeGreaterThanOrEqual(3);
		const delays = setTimeoutSpy.mock.calls.map((c) => c[1] as number);
		expect(delays.length).toBeGreaterThan(8);
		for (const d of delays) {
			expect(d).toBeGreaterThanOrEqual(10);
			expect(d).toBeLessThanOrEqual(1010);
		}
	});

	test("an exception in frame is logged and does not stop the ticker", () => {
		const log = vi.fn();
		let n = 0;
		const t = new Ticker(
			() => {
				n++;
				if (n === 1) throw new Error("boom");
				return SLOW;
			},
			10,
			() => Date.now(),
			log,
		);
		t.start();
		vi.advanceTimersByTime(3000);
		t.stop();
		expect(n).toBe(3);
		expect(log).toHaveBeenCalledTimes(1);
	});

	test("a frame that keeps throwing is logged once per 10 s and falls back to the idle plan", () => {
		const log = vi.fn();
		let n = 0;
		const t = new Ticker(
			() => {
				n++;
				if (n === 1) return { fast: true, phasesMs: [0] };
				throw new Error("boom");
			},
			10,
			() => Date.now(),
			log,
		);
		t.start();
		vi.advanceTimersByTime(25_000);
		t.stop();
		// One fast frame, then one failing frame per second instead of ten.
		expect(n).toBeLessThanOrEqual(27);
		expect(log).toHaveBeenCalledTimes(3);
	});

	test("kick from inside frame does not start a second timer chain", () => {
		let n = 0;
		const ticker: Ticker = new Ticker(() => {
			n++;
			if (n === 1) ticker.kick();
			return { fast: true, phasesMs: [0] };
		}, 10);
		ticker.start();
		vi.advanceTimersByTime(2000);
		// One chain at 10 fps: the first frame at 12:00:01.005, then every 100 ms.
		expect(n).toBe(13);
		expect(vi.getTimerCount()).toBe(1);
		ticker.stop();
		vi.advanceTimersByTime(5000);
		expect(n).toBe(13);
		expect(vi.getTimerCount()).toBe(0);
	});

	test("kick on every frame keeps the planned rate", () => {
		const { times, frame } = recorder();
		const ticker: Ticker = new Ticker((nowMs) => {
			ticker.kick();
			return frame(nowMs);
		}, 10);
		ticker.start();
		vi.advanceTimersByTime(5000);
		ticker.stop();
		expect(times).toHaveLength(5);
		expect(diffs(times)).toEqual([1000, 1000, 1000, 1000]);
	});

	test("stop and start from inside frame leave exactly one timer chain", () => {
		let n = 0;
		const ticker: Ticker = new Ticker(() => {
			n++;
			ticker.stop();
			ticker.start();
			return SLOW;
		}, 10);
		ticker.start();
		vi.advanceTimersByTime(5000);
		expect(n).toBe(5);
		expect(vi.getTimerCount()).toBe(1);
		ticker.stop();
		vi.advanceTimersByTime(5000);
		expect(n).toBe(5);
	});

	test("a kick after a frame still runs right away", () => {
		const { times, frame } = recorder();
		const ticker: Ticker = new Ticker((nowMs) => {
			if (times.length === 0) ticker.kick();
			return frame(nowMs);
		}, 10);
		ticker.start();
		vi.advanceTimersByTime(800);
		expect(times).toHaveLength(1);
		// The kick from inside the first frame must not swallow later kicks.
		vi.advanceTimersByTime(100);
		ticker.kick();
		vi.advanceTimersByTime(1);
		expect(times).toHaveLength(2);
		ticker.stop();
	});

	test("kick runs a frame right away and reschedules from there", () => {
		const { times, frame } = recorder();
		const t = new Ticker(frame, 10);
		t.kick(); // not started: nothing happens
		vi.advanceTimersByTime(1);
		expect(frame).not.toHaveBeenCalled();

		t.start();
		vi.advanceTimersByTime(100);
		t.kick();
		t.kick(); // coalesced with the first kick
		vi.advanceTimersByTime(1);
		expect(times).toHaveLength(1);
		expect(times[0]).toBeGreaterThanOrEqual(T0 + 100);
		expect(times[0]).toBeLessThanOrEqual(T0 + 101);
		vi.advanceTimersByTime(1000);
		expect(times).toHaveLength(2);
		expect((times[1] ?? Number.NaN) % 1000).toBeLessThan(20);
		t.stop();
	});
});

describe("combineFrames", () => {
	test("fast if any frame is fast, phases are the union", () => {
		const a = vi.fn(() => ({ fast: false, phasesMs: [0, 500] }));
		const b = vi.fn(() => ({ fast: true, phasesMs: [0, 250] }));
		const r = combineFrames({ a, b })(T0);
		expect(a).toHaveBeenCalledWith(T0);
		expect(b).toHaveBeenCalledWith(T0);
		expect(r.fast).toBe(true);
		expect([...r.phasesMs].sort((x, y) => x - y)).toEqual([0, 250, 500]);
	});

	test("no frames: slow, phase 0", () => {
		expect(combineFrames({})(T0)).toEqual({ fast: false, phasesMs: [0] });
	});

	test("a throwing frame function contributes nothing; the others still count; logged once per 10 s", () => {
		const log = vi.fn();
		const bad = vi.fn((): FrameResult => {
			throw new Error("boom");
		});
		const good = vi.fn(() => ({ fast: true, phasesMs: [250] }));
		const frame = combineFrames({ clocks: bad, countdowns: good }, log);
		const r = frame(T0);
		expect(good).toHaveBeenCalledWith(T0);
		expect(r.fast).toBe(true);
		expect([...r.phasesMs].sort((x, y) => x - y)).toEqual([0, 250]);
		for (let i = 1; i < 50; i++) frame(T0 + i * 100);
		expect(good).toHaveBeenCalledTimes(50);
		expect(log).toHaveBeenCalledTimes(1);
		expect(log.mock.calls[0]?.[0]).toContain("clocks");
		frame(T0 + 10_000);
		expect(log).toHaveBeenCalledTimes(2);
	});
});
