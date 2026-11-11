import { planNextFrame } from "../render/animation";
import { ThrottledLog } from "./throttled-log";

/** What a frame needs next: fast frames, and the ms offsets within a second to wake up at. */
export interface FrameResult {
	fast: boolean;
	phasesMs: number[];
}

export type FrameFn = (nowMs: number) => FrameResult;

const IDLE: FrameResult = { fast: false, phasesMs: [0] };

/**
 * One frame function over several named controllers: fast if any is fast, phases
 * united. A controller that throws contributes nothing; the others still run.
 */
export function combineFrames(
	frames: Readonly<Record<string, FrameFn>>,
	log: (message: string) => void = () => {},
): FrameFn {
	const errors = new ThrottledLog(log);
	return (nowMs) => {
		let fast = false;
		const phases = new Set<number>([0]);
		for (const [name, frame] of Object.entries(frames)) {
			try {
				const r = frame(nowMs);
				fast ||= r.fast;
				for (const p of r.phasesMs) phases.add(p);
			} catch (err) {
				errors.warn(name, `${name} frame failed: ${String(err)}`, nowMs);
			}
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
	private readonly errors: ThrottledLog;

	constructor(
		private readonly frame: FrameFn,
		private readonly fastFps: number,
		private readonly now: () => number = () => Date.now(),
		log: (message: string) => void = () => {},
	) {
		this.errors = new ThrottledLog(log);
	}

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
		// A timer that outlived stop() (or a replaced one) must not run a frame.
		if (!this.running) return;
		this.kicked = false;
		const nowMs = this.now();
		try {
			this.plan = this.frame(nowMs);
		} catch (err) {
			// Fall back to one frame per second rather than keep a stale fast plan.
			this.plan = IDLE;
			this.errors.warn("frame", `frame failed: ${String(err)}`, nowMs);
		}
		if (this.running) this.schedule();
	}

	/**
	 * Replaces any pending timer, so there is only ever one chain, even when frame
	 * calls kick() or stop()/start() itself. A kick from inside the frame is covered
	 * by the frame that is running and does not block later kicks.
	 */
	private schedule(): void {
		clearTimeout(this.timer);
		this.kicked = false;
		const delay = planNextFrame(
			this.now(),
			this.plan.phasesMs,
			this.plan.fast,
			this.fastFps,
		);
		this.timer = setTimeout(() => this.tick(), delay);
	}
}
