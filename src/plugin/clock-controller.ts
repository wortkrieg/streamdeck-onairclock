import { buildFaceModel } from "../core/clock-model";
import { type CountdownRegistry, viewCountdown } from "../core/countdown";
import type { ClockConfig } from "../core/settings";
import { animState, BLINK_MS, isAnimating } from "../render/animation";
import { renderFace } from "../render/faces";
import { toDataUri } from "../render/svg";
import type { FrameResult } from "./ticker";

/** A visible clock: a key, or a dial's touch display on the Stream Deck+. */
export interface ClockTarget {
	id: string;
	deviceId: string;
	kind: "key" | "dial";
	draw(dataUri: string): Promise<void>;
}

interface Entry {
	target: ClockTarget;
	cfg: ClockConfig;
	lastSvg?: string;
}

const mod1000 = (ms: number): number => ((ms % 1000) + 1000) % 1000;

/** Renders all visible clocks. Free of the Stream Deck SDK; the action only feeds it. */
export class ClockController {
	private readonly entries = new Map<string, Entry>();

	constructor(
		private readonly registry: CountdownRegistry,
		private readonly log: (message: string) => void = () => {},
	) {}

	add(t: ClockTarget, cfg: ClockConfig): void {
		this.entries.set(t.id, { target: t, cfg });
	}

	update(id: string, cfg: ClockConfig): void {
		const e = this.entries.get(id);
		if (e) e.cfg = cfg;
	}

	remove(id: string): void {
		this.entries.delete(id);
	}

	/** A press on a clock cancels its device's countdown, if the clock shows countdowns. */
	press(id: string, nowMs: number): void {
		const e = this.entries.get(id);
		if (!e?.cfg.showCountdown) return;
		if (this.registry.get(e.target.deviceId, nowMs))
			this.registry.cancel(e.target.deviceId);
	}

	/** Renders every clock and draws only the ones whose image changed. */
	frame(nowMs: number): FrameResult {
		let fast = false;
		const phases = new Set<number>([0]);
		for (const e of this.entries.values()) {
			const countdown = this.registry.get(e.target.deviceId, nowMs);
			const model = buildFaceModel(
				nowMs,
				e.cfg,
				countdown
					? { countdown, view: viewCountdown(countdown, nowMs) }
					: undefined,
			);
			const anim = animState(model, e.cfg);
			if (isAnimating(anim)) fast = true;

			if (model.mode === "clock" && e.cfg.blinkColon) phases.add(BLINK_MS);
			if (countdown) {
				phases.add(mod1000(countdown.startMs));
				// The ring blinks on the countdown's own second, half a second after each tick.
				const phase = model.countdown?.phase;
				if (phase === "overtime" || phase === "hold" || phase === "flash")
					phases.add(mod1000(countdown.startMs + BLINK_MS));
			}

			const svg = renderFace(e.cfg.face, model, e.cfg.colors, anim);
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
			this.log(`drawing clock ${e.target.id} failed: ${String(err)}`);
		});
	}
}
