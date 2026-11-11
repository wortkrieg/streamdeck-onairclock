import { buildFaceModel } from "../core/clock-model";
import { type CountdownRegistry, viewCountdown } from "../core/countdown";
import type { ClockConfig } from "../core/settings";
import { FAST_FPS } from "../hardware";
import {
	animState,
	BLINK_MS,
	countdownRingPhasesMs,
	isAnimating,
	STEP_PHASES_MS,
} from "../render/animation";
import { renderFace } from "../render/faces";
import { toDataUri } from "../render/svg";
import { ThrottledLog } from "./throttled-log";
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
	private readonly errors: ThrottledLog;

	constructor(
		private readonly registry: CountdownRegistry,
		log: (message: string) => void = () => {},
	) {
		this.errors = new ThrottledLog(log);
	}

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

	/**
	 * Renders every clock and draws only the ones whose image changed. A clock that
	 * fails to render is skipped (and retried next frame); the others still draw.
	 */
	frame(nowMs: number): FrameResult {
		let fast = false;
		const phases = new Set<number>([0]);
		for (const e of this.entries.values()) {
			try {
				const r = this.frameEntry(e, nowMs);
				fast ||= r.fast;
				for (const p of r.phasesMs) phases.add(p);
			} catch (err) {
				e.lastSvg = undefined;
				this.errors.warn(
					e.target.id,
					`rendering clock ${e.target.id} failed: ${String(err)}`,
					nowMs,
				);
			}
		}
		return { fast, phasesMs: [...phases] };
	}

	private frameEntry(e: Entry, nowMs: number): FrameResult {
		const phasesMs: number[] = [];
		const countdown = this.registry.get(e.target.deviceId, nowMs);
		const model = buildFaceModel(
			nowMs,
			e.cfg,
			countdown
				? { countdown, view: viewCountdown(countdown, nowMs) }
				: undefined,
		);
		const anim = animState(model, e.cfg);

		if (model.mode === "clock") {
			if (e.cfg.blinkColon) phasesMs.push(BLINK_MS);
			// The stepped afterglow and seconds roll change only at these phases.
			if (e.cfg.animations) phasesMs.push(...STEP_PHASES_MS);
		}
		if (countdown) {
			phasesMs.push(mod1000(countdown.startMs));
			// The ring blinks on the countdown's own second, half a second after each tick.
			const phase = model.countdown?.phase;
			if (phase === "overtime" || phase === "hold" || phase === "flash")
				phasesMs.push(mod1000(countdown.startMs + BLINK_MS));
			// A clock showing a running countdown steps its afterglow on the countdown's
			// second; the fast roll frames cover the early steps, not the last one.
			if (phase === "running" && e.cfg.animations)
				for (const p of STEP_PHASES_MS)
					phasesMs.push(mod1000(countdown.startMs + p));
			// Even frames so the ring of a short countdown moves smoothly.
			if (phase === "running")
				phasesMs.push(
					...countdownRingPhasesMs(
						countdown.startMs,
						countdown.durationMs,
						FAST_FPS,
					),
				);
		}

		const svg = renderFace(e.cfg.face, model, e.cfg.colors, anim);
		if (svg !== e.lastSvg) {
			e.lastSvg = svg;
			this.draw(e, svg, nowMs);
		}
		return { fast: isAnimating(anim), phasesMs };
	}

	private draw(e: Entry, svg: string, nowMs: number): void {
		e.target.draw(toDataUri(svg)).catch((err: unknown) => {
			// Retry on the next frame unless a newer image is already on its way.
			if (e.lastSvg === svg) e.lastSvg = undefined;
			this.errors.warn(
				e.target.id,
				`drawing clock ${e.target.id} failed: ${String(err)}`,
				nowMs,
			);
		});
	}
}
