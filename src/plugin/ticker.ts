import { planNextFrame } from "../render/animation";

/** What a frame needs next: fast frames, and the ms offsets within a second to wake up at. */
export interface FrameResult {
	fast: boolean;
	phasesMs: number[];
}

export type FrameFn = (nowMs: number) => FrameResult;

const IDLE: FrameResult = { fast: false, phasesMs: [0] };

/** One frame function over several controllers: fast if any is fast, phases united. */
export function combineFrames(frames: readonly FrameFn[]): FrameFn {
	return (nowMs) => {
		let fast = false;
		const phases = new Set<number>([0]);
		for (const frame of frames) {
			const r = frame(nowMs);
			fast ||= r.fast;
			for (const p of r.phasesMs) phases.add(p);
		}
		return { fast, phasesMs: [...phases] };
	};
}

/**
 * The single shared clock tick for all keys. Each tick runs `frame` and plans the next
 * one from its result with `planNextFrame`, so the delay stays within [10, 1010] ms
 * even when the system clock jumps.
 */
export class Ticker {
	private timer: ReturnType<typeof setTimeout> | undefined;
	private running = false;
	private kicked = false;
	private plan: FrameResult = IDLE;

	constructor(
		private readonly frame: FrameFn,
		private readonly fastFps: number,
		private readonly now: () => number = () => Date.now(),
		private readonly log: (message: string) => void = () => {},
	) {}

	start(): void {
		if (this.running) return;
		this.running = true;
		this.schedule();
	}

	stop(): void {
		this.running = false;
		this.kicked = false;
		clearTimeout(this.timer);
		this.timer = undefined;
	}

	/** Runs a frame as soon as possible (e.g. a key appeared or was pressed), then plans on from there. */
	kick(): void {
		if (!this.running || this.kicked) return;
		this.kicked = true;
		clearTimeout(this.timer);
		this.timer = setTimeout(() => this.tick(), 0);
	}

	private tick(): void {
		this.kicked = false;
		try {
			this.plan = this.frame(this.now());
		} catch (err) {
			this.log(`frame failed: ${String(err)}`);
		}
		if (this.running) this.schedule();
	}

	private schedule(): void {
		const delay = planNextFrame(
			this.now(),
			this.plan.phasesMs,
			this.plan.fast,
			this.fastFps,
		);
		this.timer = setTimeout(() => this.tick(), delay);
	}
}
