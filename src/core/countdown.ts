import { formatMMSS } from "./format";
import {
	type CountdownConfig,
	type EndMode,
	MAX_DURATION_SEC,
} from "./settings";

export interface Countdown {
	deviceId: string;
	sourceActionId: string;
	startMs: number;
	durationMs: number;
	endMode: EndMode;
	warn: boolean;
}

export type CountdownView =
	| { phase: "running"; remainingMs: number; fraction: number; warn: boolean }
	| { phase: "overtime"; overMs: number }
	| { phase: "hold"; sinceZeroMs: number }
	| { phase: "flash"; sinceZeroMs: number }
	| { phase: "finished" };

export const FLASH_MS = 2000;
const WARN_MS = 10000;

export function viewCountdown(c: Countdown, nowMs: number): CountdownView {
	// A backwards-jumping system clock counts as "just started".
	const elapsed = Math.max(0, nowMs - c.startMs);
	const remainingMs = c.durationMs - elapsed;
	if (remainingMs > 0) {
		return {
			phase: "running",
			remainingMs,
			fraction: c.durationMs > 0 ? remainingMs / c.durationMs : 0,
			warn: c.warn && remainingMs <= WARN_MS,
		};
	}
	const sinceZeroMs = elapsed - c.durationMs;
	switch (c.endMode) {
		case "overtime":
			return { phase: "overtime", overMs: sinceZeroMs };
		case "hold":
			return { phase: "hold", sinceZeroMs };
		case "clock":
			return sinceZeroMs < FLASH_MS
				? { phase: "flash", sinceZeroMs }
				: { phase: "finished" };
	}
}

/**
 * A countdown key's duration after a + or − step: at most 99:59, and a step that would
 * reach zero is left out.
 */
export function adjustDuration(durationSec: number, deltaSec: number): number {
	const next = durationSec + deltaSec;
	if (next > MAX_DURATION_SEC) return MAX_DURATION_SEC;
	return next < 1 ? durationSec : next;
}

export function countdownDigits(v: CountdownView): string {
	switch (v.phase) {
		case "running":
			return formatMMSS(Math.ceil(v.remainingMs / 1000));
		case "overtime":
			return `+${formatMMSS(Math.floor(v.overMs / 1000))}`;
		default:
			return "00:00";
	}
}

export class CountdownRegistry {
	private readonly byDevice = new Map<string, Countdown>();

	press(
		deviceId: string,
		actionId: string,
		cfg: CountdownConfig,
		nowMs: number,
	): "started" | "cancelled" {
		const active = this.get(deviceId, nowMs);
		if (active && active.sourceActionId === actionId) {
			this.byDevice.delete(deviceId);
			return "cancelled";
		}
		this.byDevice.set(deviceId, {
			deviceId,
			sourceActionId: actionId,
			startMs: nowMs,
			durationMs: cfg.durationSec * 1000,
			endMode: cfg.endMode,
			warn: cfg.warn,
		});
		return "started";
	}

	/**
	 * Changes the remaining time of the device's running countdown by `deltaSec`, between
	 * zero (which ends it like reaching zero) and 99:59. False if none is running there.
	 */
	adjust(deviceId: string, deltaSec: number, nowMs: number): boolean {
		const c = this.get(deviceId, nowMs);
		if (!c) return false;
		const view = viewCountdown(c, nowMs);
		if (view.phase !== "running") return false;
		const remainingMs = Math.min(
			MAX_DURATION_SEC * 1000,
			Math.max(0, view.remainingMs + deltaSec * 1000),
		);
		const elapsedMs = c.durationMs - view.remainingMs;
		this.byDevice.set(deviceId, { ...c, durationMs: elapsedMs + remainingMs });
		return true;
	}

	cancel(deviceId: string): boolean {
		return this.byDevice.delete(deviceId);
	}

	get(deviceId: string, nowMs: number): Countdown | undefined {
		const c = this.byDevice.get(deviceId);
		if (!c) return undefined;
		if (viewCountdown(c, nowMs).phase === "finished") {
			this.byDevice.delete(deviceId);
			return undefined;
		}
		return c;
	}
}
