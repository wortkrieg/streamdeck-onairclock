import { type CountdownRegistry, viewCountdown } from "../core/countdown";
import type { CountdownConfig } from "../core/settings";
import { BLINK_MS } from "../render/animation";
import { renderCountdownKey } from "../render/countdown-key";
import { toDataUri } from "../render/svg";
import type { FrameResult } from "./ticker";

/** A visible countdown key. */
export interface CountdownTarget {
	id: string;
	deviceId: string;
	draw(dataUri: string): Promise<void>;
}

interface Entry {
	target: CountdownTarget;
	cfg: CountdownConfig;
	lastSvg?: string;
}

const mod1000 = (ms: number): number => ((ms % 1000) + 1000) % 1000;

/** Drives all countdown keys. Free of the Stream Deck SDK; the action only feeds it. */
export class CountdownController {
	private readonly entries = new Map<string, Entry>();

	constructor(
		private readonly registry: CountdownRegistry,
		private readonly log: (message: string) => void = () => {},
	) {}

	add(t: CountdownTarget, cfg: CountdownConfig): void {
		this.entries.set(t.id, { target: t, cfg });
	}

	update(id: string, cfg: CountdownConfig): void {
		const e = this.entries.get(id);
		if (e) e.cfg = cfg;
	}

	/** Leaving a page removes the key but does not end a running countdown. */
	remove(id: string): void {
		this.entries.delete(id);
	}

	/** Starts this key's countdown on its device, or cancels it if it is already running. */
	press(id: string, nowMs: number): "started" | "cancelled" {
		const e = this.entries.get(id);
		if (!e) return "cancelled";
		return this.registry.press(e.target.deviceId, id, e.cfg, nowMs);
	}

	/** Renders every key and draws only the ones whose image changed. */
	frame(nowMs: number): FrameResult {
		let fast = false;
		const phases = new Set<number>([0]);
		for (const e of this.entries.values()) {
			// Only the key that started the device's countdown shows it.
			const countdown = this.registry.get(e.target.deviceId, nowMs);
			const own = countdown?.sourceActionId === e.target.id ? countdown : null;
			const view = own ? viewCountdown(own, nowMs) : null;

			if (own && view) {
				phases.add(mod1000(own.startMs));
				if (view.phase === "running" && view.warn) fast = true;
				if (
					view.phase === "overtime" ||
					view.phase === "hold" ||
					view.phase === "flash"
				)
					phases.add(mod1000(own.startMs + BLINK_MS));
				if (view.phase === "flash") fast = true;
			}

			const svg = renderCountdownKey(view, e.cfg.durationSec, e.cfg.color);
			if (svg !== e.lastSvg) {
				e.lastSvg = svg;
				this.draw(e, svg);
			}
		}
		return { fast, phasesMs: [...phases] };
	}

	private draw(e: Entry, svg: string): void {
		e.target.draw(toDataUri(svg)).catch((err: unknown) => {
			// Retry on the next frame unless a newer image is already on its way.
			if (e.lastSvg === svg) e.lastSvg = undefined;
			this.log(`drawing countdown key ${e.target.id} failed: ${String(err)}`);
		});
	}
}
