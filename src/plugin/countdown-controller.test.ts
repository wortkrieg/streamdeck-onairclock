import { describe, expect, test, vi } from "vitest";
import { CountdownRegistry, viewCountdown } from "../core/countdown";
import type { CountdownConfig } from "../core/settings";
import { renderCountdownKey } from "../render/countdown-key";
import { toDataUri } from "../render/svg";
import {
	CountdownController,
	type CountdownTarget,
} from "./countdown-controller";

const T0 = Date.UTC(2026, 10, 11, 12, 0, 0);
const CFG: CountdownConfig = {
	durationSec: 60,
	endMode: "overtime",
	warn: false,
	color: "#FF3B2F",
	adjustable: true,
};

function target(id: string, deviceId = "A") {
	return {
		id,
		deviceId,
		draw: vi.fn<(uri: string) => Promise<void>>(() => Promise.resolve()),
		saveDuration: vi.fn<(durationSec: number) => Promise<void>>(() =>
			Promise.resolve(),
		),
	} satisfies CountdownTarget;
}

function setup() {
	const registry = new CountdownRegistry();
	const c = new CountdownController(registry);
	return { registry, c };
}

const idle = (cfg = CFG) =>
	toDataUri(renderCountdownKey(null, cfg.durationSec, cfg.color));

describe("CountdownController", () => {
	test("press starts the countdown for the key's device, a second press cancels", () => {
		const { registry, c } = setup();
		c.add(target("k1", "A"), CFG);
		expect(c.press("k1", T0)).toBe("started");
		expect(registry.get("A", T0)?.sourceActionId).toBe("k1");
		expect(registry.get("B", T0)).toBeUndefined();
		expect(c.press("k1", T0 + 1000)).toBe("cancelled");
		expect(registry.get("A", T0 + 1000)).toBeUndefined();
	});

	test("a second countdown key replaces the first, which shows idle again", () => {
		const { c } = setup();
		const t1 = target("k1");
		const t2 = target("k2");
		c.add(t1, CFG);
		c.add(t2, CFG);
		c.press("k1", T0);
		c.frame(T0 + 1000);
		c.press("k2", T0 + 2000);
		c.frame(T0 + 2000);
		expect(t1.draw).toHaveBeenLastCalledWith(idle());
		expect(t2.draw).toHaveBeenLastCalledWith(
			toDataUri(
				renderCountdownKey(
					viewCountdown(
						{
							deviceId: "A",
							sourceActionId: "k2",
							startMs: T0 + 2000,
							durationMs: 60000,
							endMode: "overtime",
							warn: false,
						},
						T0 + 2000,
					),
					60,
					CFG.color,
				),
			),
		);
	});

	test("removing the starting key does not end the countdown", () => {
		const { registry, c } = setup();
		c.add(target("k1"), CFG);
		c.press("k1", T0);
		c.remove("k1");
		expect(registry.get("A", T0 + 1000)?.sourceActionId).toBe("k1");
	});

	test("shows the duration when idle, the remaining time when active, draws only on change", () => {
		const { c } = setup();
		const t = target("k1");
		c.add(t, CFG);
		c.frame(T0);
		c.frame(T0 + 500);
		expect(t.draw).toHaveBeenCalledTimes(1);
		expect(t.draw).toHaveBeenCalledWith(idle());
		c.press("k1", T0 + 500);
		c.frame(T0 + 500);
		expect(t.draw).toHaveBeenCalledTimes(2);
		expect(t.draw.mock.calls[1]?.[0]).not.toBe(idle());
		c.frame(T0 + 500);
		expect(t.draw).toHaveBeenCalledTimes(2);
		c.frame(T0 + 1500);
		expect(t.draw).toHaveBeenCalledTimes(3);
	});

	test("update changes the idle image", () => {
		const { c } = setup();
		const t = target("k1");
		c.add(t, CFG);
		c.frame(T0);
		const next = { ...CFG, durationSec: 90 };
		c.update("k1", next);
		c.frame(T0 + 1000);
		expect(t.draw).toHaveBeenLastCalledWith(idle(next));
	});

	test("fast only while a warning countdown is in its last 10 s", () => {
		const { c } = setup();
		c.add(target("k1"), { ...CFG, warn: true });
		expect(c.frame(T0).fast).toBe(false);
		c.press("k1", T0);
		expect(c.frame(T0 + 49000).fast).toBe(false);
		expect(c.frame(T0 + 51000).fast).toBe(true);
	});

	test("not fast without warn, phases follow the countdown start", () => {
		const { c } = setup();
		c.add(target("k1"), CFG);
		c.press("k1", T0 + 250);
		const r = c.frame(T0 + 20000);
		expect(r.fast).toBe(false);
		expect(r.phasesMs).toContain(250);
		const over = c.frame(T0 + 250 + 61000);
		expect(over.phasesMs).toContain(250);
		expect(over.phasesMs).toContain(750);
	});

	test("a key whose render throws does not stop the others; retried, logged once per 10 s", () => {
		const log = vi.fn();
		const c = new CountdownController(new CountdownRegistry(), log);
		const a = target("a");
		const broken = target("broken");
		const b = target("b", "B");
		c.add(a, CFG);
		c.add(broken, undefined as unknown as CountdownConfig);
		c.add(b, CFG);
		c.press("b", T0);
		for (let i = 0; i < 30; i++)
			expect(() => c.frame(T0 + i * 100)).not.toThrow();
		expect(a.draw).toHaveBeenLastCalledWith(idle());
		expect(b.draw.mock.calls.length).toBeGreaterThan(1);
		expect(broken.draw).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledTimes(1);
		expect(log.mock.calls[0]?.[0]).toContain("broken");

		c.frame(T0 + 10_000);
		expect(log).toHaveBeenCalledTimes(2);
		c.update("broken", CFG);
		c.frame(T0 + 10_000);
		expect(broken.draw).toHaveBeenCalledWith(idle());
	});

	test("flash is fast; a failed draw is retried", async () => {
		const { c } = setup();
		const t = target("k1");
		t.draw.mockRejectedValueOnce(new Error("x"));
		c.add(t, { ...CFG, endMode: "clock" });
		c.frame(T0);
		await Promise.resolve();
		await Promise.resolve();
		c.frame(T0 + 10);
		expect(t.draw).toHaveBeenCalledTimes(2);
		c.press("k1", T0);
		expect(c.frame(T0 + 60000).fast).toBe(true);
	});
});

describe("CountdownController.adjust", () => {
	test("changes a running countdown and leaves the keys' durations alone", () => {
		const { registry, c } = setup();
		const t1 = target("k1");
		c.add(t1, CFG);
		c.press("k1", T0);
		expect(c.adjust("A", 60, T0 + 1000)).toBe("running");
		expect(registry.get("A", T0 + 1000)?.durationMs).toBe(120_000);
		expect(t1.saveDuration).not.toHaveBeenCalled();
	});

	test("without a running countdown it sets every adjustable countdown key on the device", () => {
		const { registry, c } = setup();
		const a = target("a");
		const fixed = target("fixed");
		const other = target("other", "B");
		c.add(a, CFG);
		c.add(fixed, { ...CFG, adjustable: false });
		c.add(other, CFG);
		expect(c.adjust("A", 60, T0)).toBe("keys");
		expect(a.saveDuration).toHaveBeenCalledWith(120);
		expect(fixed.saveDuration).not.toHaveBeenCalled();
		expect(other.saveDuration).not.toHaveBeenCalled();
		c.frame(T0);
		expect(a.draw).toHaveBeenLastCalledWith(idle({ ...CFG, durationSec: 120 }));
		expect(fixed.draw).toHaveBeenLastCalledWith(idle());
		c.press("a", T0 + 1000);
		expect(registry.get("A", T0 + 1000)?.durationMs).toBe(120_000);
	});

	test("after zero the countdown is over and the keys are set again", () => {
		const { registry, c } = setup();
		const a = target("a");
		c.add(a, CFG);
		c.press("a", T0);
		expect(c.adjust("A", -10, T0 + 61_000)).toBe("keys");
		expect(a.saveDuration).toHaveBeenCalledWith(50);
		expect(registry.get("A", T0 + 61_000)?.durationMs).toBe(60_000);
	});

	test("a step that changes nothing saves nothing", () => {
		const { c } = setup();
		const a = target("a");
		c.add(a, { ...CFG, durationSec: 30 });
		expect(c.adjust("A", -60, T0)).toBe("keys");
		expect(a.saveDuration).not.toHaveBeenCalled();
	});

	test("reports none when nothing on the device can be adjusted", () => {
		const { c } = setup();
		expect(c.adjust("A", 60, T0)).toBe("none");
		c.add(target("fixed"), { ...CFG, adjustable: false });
		c.add(target("elsewhere", "B"), CFG);
		expect(c.adjust("A", 60, T0)).toBe("none");
	});

	test("a failed save is logged and the key keeps its new duration", async () => {
		const log = vi.fn();
		const c = new CountdownController(new CountdownRegistry(), log);
		const a = target("a");
		a.saveDuration.mockRejectedValueOnce(new Error("offline"));
		c.add(a, CFG);
		c.adjust("A", 60, T0);
		await Promise.resolve();
		await Promise.resolve();
		expect(log).toHaveBeenCalledWith(expect.stringContaining("offline"));
		c.frame(T0);
		expect(a.draw).toHaveBeenLastCalledWith(idle({ ...CFG, durationSec: 120 }));
	});
});
