import { afterEach, expect, test, vi } from "vitest";
import {
	redetectSystemZone,
	watchSystemZone,
	ZONE_CHECK_MS,
} from "./system-zone";

const NOON_UTC = Date.UTC(2026, 10, 11, 12);
const saved = process.env.TZ;

afterEach(() => {
	if (saved === undefined) delete process.env.TZ;
	else process.env.TZ = saved;
	vi.useRealTimers();
});

test("without TZ it deletes the key, which makes Node re-detect the zone", () => {
	const deleted: (string | symbol)[] = [];
	const env = new Proxy<NodeJS.ProcessEnv>(
		{},
		{
			deleteProperty(target, key) {
				deleted.push(key);
				return Reflect.deleteProperty(target, key);
			},
		},
	);
	redetectSystemZone(env);
	expect(deleted).toEqual(["TZ"]);
	expect(env.TZ).toBeUndefined();
});

test("an explicit TZ stays and keeps pinning the zone", () => {
	process.env.TZ = "Asia/Tokyo";
	redetectSystemZone();
	expect(process.env.TZ).toBe("Asia/Tokyo");
	expect(new Date(NOON_UTC).getHours()).toBe(21);
});

test("Node takes the zone again from the host once TZ is deleted", () => {
	process.env.TZ = "Asia/Tokyo";
	expect(new Date(NOON_UTC).getHours()).toBe(21);
	delete process.env.TZ;
	expect(Intl.DateTimeFormat().resolvedOptions().timeZone).not.toBe(
		"Asia/Tokyo",
	);
});

test("watchSystemZone re-detects on its interval until stopped", () => {
	vi.useFakeTimers();
	const redetect = vi.fn();
	const stop = watchSystemZone(ZONE_CHECK_MS, redetect);
	vi.advanceTimersByTime(ZONE_CHECK_MS * 3);
	expect(redetect).toHaveBeenCalledTimes(3);
	stop();
	vi.advanceTimersByTime(ZONE_CHECK_MS * 3);
	expect(redetect).toHaveBeenCalledTimes(3);
});
