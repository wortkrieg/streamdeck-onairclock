import { describe, expect, type Mock, test, vi } from "vitest";
import { buildFaceModel } from "../core/clock-model";
import { CountdownRegistry, viewCountdown } from "../core/countdown";
import {
	CLOCK_DEFAULTS,
	type ClockConfig,
	type CountdownConfig,
} from "../core/settings";
import { animState } from "../render/animation";
import { renderFace } from "../render/faces";
import { toDataUri } from "../render/svg";
import { ClockController, type ClockTarget } from "./clock-controller";

/** 2026-11-11 12:00:00.000 UTC, on a full second. */
const T0 = Date.UTC(2026, 10, 11, 12, 0, 0);
const CD: CountdownConfig = {
	durationSec: 300,
	endMode: "overtime",
	warn: false,
	color: "#FF3B2F",
	adjustable: true,
};

type FakeTarget = ClockTarget & { draw: Mock<(uri: string) => Promise<void>> };

function target(id: string, deviceId = "A"): FakeTarget {
	return {
		id,
		deviceId,
		kind: "key",
		draw: vi.fn<(uri: string) => Promise<void>>(() => Promise.resolve()),
	};
}

const cfg = (over: Partial<ClockConfig> = {}): ClockConfig => ({
	...CLOCK_DEFAULTS,
	...over,
});

/** Reference rendering, independent of the controller's bookkeeping. */
function expected(
	nowMs: number,
	c: ClockConfig,
	registry?: CountdownRegistry,
	deviceId = "A",
): string {
	const countdown = registry?.get(deviceId, nowMs);
	const model = buildFaceModel(
		nowMs,
		c,
		countdown
			? { countdown, view: viewCountdown(countdown, nowMs) }
			: undefined,
	);
	return toDataUri(renderFace(c.face, model, c.colors, animState(model, c)));
}

const lastUri = (t: FakeTarget): string | undefined =>
	t.draw.mock.calls.at(-1)?.[0];

describe("ClockController drawing", () => {
	test("two frames in the same millisecond draw each target once", () => {
		const c = new ClockController(new CountdownRegistry());
		const a = target("a");
		const b = target("b", "B");
		c.add(a, cfg());
		c.add(b, cfg({ face: "line" }));
		c.frame(T0 + 123);
		c.frame(T0 + 123);
		expect(a.draw).toHaveBeenCalledTimes(1);
		expect(b.draw).toHaveBeenCalledTimes(1);
		expect(lastUri(a)).toBe(expected(T0 + 123, cfg()));
		expect(lastUri(b)).toBe(expected(T0 + 123, cfg({ face: "line" })));
	});

	test("15 targets: 15 draws on the first frame, none on an identical second frame", () => {
		const c = new ClockController(new CountdownRegistry());
		const targets = Array.from({ length: 15 }, (_, i) => target(`k${i}`));
		for (const t of targets) c.add(t, cfg());
		c.frame(T0 + 700);
		const first = targets.reduce((n, t) => n + t.draw.mock.calls.length, 0);
		c.frame(T0 + 700);
		const total = targets.reduce((n, t) => n + t.draw.mock.calls.length, 0);
		expect(first).toBe(15);
		expect(total).toBe(15);
	});

	test("update with a new face draws again", () => {
		const c = new ClockController(new CountdownRegistry());
		const a = target("a");
		c.add(a, cfg());
		c.frame(T0 + 700);
		c.update("a", cfg({ face: "big" }));
		c.frame(T0 + 700);
		expect(a.draw).toHaveBeenCalledTimes(2);
		expect(lastUri(a)).toBe(expected(T0 + 700, cfg({ face: "big" })));
	});

	test("remove stops drawing; update and press of unknown ids are ignored", () => {
		const c = new ClockController(new CountdownRegistry());
		const a = target("a");
		c.add(a, cfg());
		c.remove("a");
		c.update("a", cfg({ face: "big" }));
		c.press("a", T0);
		c.frame(T0 + 700);
		expect(a.draw).not.toHaveBeenCalled();
	});

	test("a rejected draw neither throws nor stops later frames, and is logged", async () => {
		const log = vi.fn();
		const c = new ClockController(new CountdownRegistry(), log);
		const a = target("a");
		a.draw.mockRejectedValueOnce(new Error("gone"));
		c.add(a, cfg());
		expect(() => c.frame(T0 + 700)).not.toThrow();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(log).toHaveBeenCalledTimes(1);
		// The failed image is retried on the next frame even if it did not change.
		c.frame(T0 + 700);
		expect(a.draw).toHaveBeenCalledTimes(2);
	});

	test("a target whose render throws does not stop the others; retried, logged once per 10 s", () => {
		const log = vi.fn();
		const c = new ClockController(new CountdownRegistry(), log);
		const a = target("a");
		const broken = target("broken");
		const b = target("b");
		const brokenCfg = cfg({
			colors: undefined as unknown as ClockConfig["colors"],
		});
		c.add(a, cfg());
		c.add(broken, brokenCfg);
		c.add(b, cfg({ face: "line" }));

		const start = T0 + 5_700;
		for (let i = 0; i < 30; i++)
			expect(() => c.frame(start + i * 100)).not.toThrow();
		const last = start + 29 * 100;
		expect(lastUri(a)).toBe(expected(last, cfg()));
		expect(lastUri(b)).toBe(expected(last, cfg({ face: "line" })));
		expect(broken.draw).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledTimes(1);
		expect(log.mock.calls[0]?.[0]).toContain("broken");

		c.frame(start + 10_000);
		expect(log).toHaveBeenCalledTimes(2);

		// Once its settings are fixed it draws again on the next frame.
		c.update("broken", cfg());
		c.frame(start + 10_000);
		expect(broken.draw).toHaveBeenCalledTimes(1);
	});

	test("a draw that throws synchronously is retried on the next frame", () => {
		const log = vi.fn();
		const c = new ClockController(new CountdownRegistry(), log);
		const a = target("a");
		const b = target("b");
		a.draw.mockImplementationOnce(() => {
			throw new Error("sync");
		});
		c.add(a, cfg());
		c.add(b, cfg());
		expect(() => c.frame(T0 + 700)).not.toThrow();
		expect(b.draw).toHaveBeenCalledTimes(1);
		c.frame(T0 + 700);
		expect(a.draw).toHaveBeenCalledTimes(2);
		expect(log).toHaveBeenCalledTimes(1);
	});
});

describe("ClockController with a countdown", () => {
	test("only targets on the countdown's device with showCountdown show it", () => {
		const registry = new CountdownRegistry();
		const c = new ClockController(registry);
		const onA = target("onA", "A");
		const onAOff = target("onAOff", "A");
		const onB = target("onB", "B");
		c.add(onA, cfg());
		c.add(onAOff, cfg({ showCountdown: false }));
		c.add(onB, cfg());
		registry.press("A", "cd-key", CD, T0);
		const now = T0 + 12_345;
		c.frame(now);

		const countdownImage = expected(now, cfg(), registry, "A");
		const clockImage = expected(now, cfg());
		expect(countdownImage).not.toBe(clockImage);
		expect(lastUri(onA)).toBe(countdownImage);
		expect(lastUri(onAOff)).toBe(expected(now, cfg({ showCountdown: false })));
		expect(lastUri(onAOff)).toBe(clockImage);
		expect(lastUri(onB)).toBe(clockImage);
	});

	test("press on a clock with showCountdown cancels its device's countdown", () => {
		const registry = new CountdownRegistry();
		const c = new ClockController(registry);
		c.add(target("onA", "A"), cfg());
		c.add(target("onB", "B"), cfg());
		registry.press("A", "cd-key", CD, T0);
		registry.press("B", "cd-key-b", CD, T0);
		c.press("onA", T0 + 1000);
		expect(registry.get("A", T0 + 1000)).toBeUndefined();
		expect(registry.get("B", T0 + 1000)).toBeDefined();
	});

	test("press on a clock without showCountdown leaves the countdown running", () => {
		const registry = new CountdownRegistry();
		const c = new ClockController(registry);
		c.add(target("off", "A"), cfg({ showCountdown: false }));
		registry.press("A", "cd-key", CD, T0);
		c.press("off", T0 + 1000);
		expect(registry.get("A", T0 + 1000)).toBeDefined();
	});

	test("face change during a running countdown shows the new face in countdown mode", () => {
		const registry = new CountdownRegistry();
		const c = new ClockController(registry);
		const a = target("a");
		c.add(a, cfg());
		registry.press("A", "cd-key", CD, T0);
		c.frame(T0 + 2000);
		c.update("a", cfg({ face: "comet" }));
		expect(() => c.frame(T0 + 2000)).not.toThrow();
		expect(a.draw).toHaveBeenCalledTimes(2);
		expect(lastUri(a)).toBe(
			expected(T0 + 2000, cfg({ face: "comet" }), registry, "A"),
		);
		expect(lastUri(a)).not.toBe(expected(T0 + 2000, cfg({ face: "comet" })));
	});
});

describe("ClockController frame timing", () => {
	test("plain clock without blinking colon: phase 0 only, not fast when static", () => {
		const c = new ClockController(new CountdownRegistry());
		c.add(
			target("a"),
			cfg({ blinkColon: false, animations: false, showSeconds: false }),
		);
		expect(c.frame(T0 + 700)).toEqual({ fast: false, phasesMs: [0] });
	});

	test("phases include startMs % 1000 of active countdowns and 500 for a blinking colon", () => {
		const registry = new CountdownRegistry();
		const c = new ClockController(registry);
		c.add(target("blink", "A"), cfg({ blinkColon: true }));
		c.add(target("cd", "B"), cfg({ blinkColon: false }));
		registry.press("B", "cd-key", CD, T0 + 250);
		const { phasesMs } = c.frame(T0 + 5_700);
		expect(phasesMs).toContain(0);
		expect(phasesMs).toContain(500);
		expect(phasesMs).toContain(250);
	});

	test("no 500 phase without a visible blinking colon", () => {
		const registry = new CountdownRegistry();
		const c = new ClockController(registry);
		// blinkColon on, but the target shows the countdown, where the colon does not blink.
		c.add(target("cd", "A"), cfg({ blinkColon: true, animations: false }));
		registry.press("A", "cd-key", CD, T0 + 250);
		const { phasesMs } = c.frame(T0 + 5_700);
		expect([...phasesMs].sort((x, y) => x - y)).toEqual([0, 250]);
	});

	test("a blinking countdown ring adds the half-second phase of its countdown", () => {
		const registry = new CountdownRegistry();
		const c = new ClockController(registry);
		c.add(target("cd", "A"), cfg({ blinkColon: false }));
		registry.press("A", "cd-key", { ...CD, durationSec: 1 }, T0 + 250);
		// 1.5 s after the start: 0.5 s into overtime.
		const { phasesMs } = c.frame(T0 + 1_750);
		expect([...phasesMs].sort((x, y) => x - y)).toEqual([0, 250, 750]);
	});

	test("fast only while the minute changes", () => {
		const c = new ClockController(new CountdownRegistry());
		c.add(target("a"), cfg({ animations: true }));
		// 100 ms after the full minute: hours and minutes roll, the ring resets.
		expect(c.frame(T0 + 100).fast).toBe(true);
		// 100 ms after any other second: afterglow and seconds roll are stepped.
		expect(c.frame(T0 + 5_100).fast).toBe(false);
	});

	test("animations add the step phases of the afterglow in clock mode", () => {
		const c = new ClockController(new CountdownRegistry());
		c.add(target("a"), cfg({ animations: true, blinkColon: false }));
		const { phasesMs } = c.frame(T0 + 5_700);
		expect([...phasesMs].sort((x, y) => x - y)).toEqual([0, 250, 500]);
	});

	test("a clock showing a running countdown steps on the countdown's second", () => {
		const registry = new CountdownRegistry();
		const c = new ClockController(registry);
		c.add(target("cd", "A"), cfg({ animations: true }));
		registry.press("A", "cd-key", CD, T0 + 250);
		const { phasesMs } = c.frame(T0 + 5_700);
		expect([...new Set(phasesMs)].sort((x, y) => x - y)).toEqual([
			0, 250, 500, 750,
		]);
	});
});
