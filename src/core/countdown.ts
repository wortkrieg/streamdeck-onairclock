import { formatMMSS } from "./format";
import type { CountdownConfig, EndMode } from "./settings";

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
			// The ring moves once per second, together with the digits. A continuous
			// fraction drawn at the uneven frame rate jumps visibly on short
			// countdowns (24 degrees per second at 15 s).
			fraction:
				c.durationMs > 0
					? Math.min(1, (Math.ceil(remainingMs / 1000) * 1000) / c.durationMs)
					: 0,
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
