/** Holding a + or − key repeats its step after this delay ... */
export const REPEAT_DELAY_MS = 450;
/** ... at this interval, until the key is released. */
export const REPEAT_INTERVAL_MS = 120;

/** A step; false means there was nothing to change, so holding the key stops repeating. */
export type Step = () => boolean;

/** Repeats a key's step while it is held, like the arrow keys of a keyboard. */
export class KeyRepeater {
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

	constructor(private readonly onError: (err: unknown) => void = () => {}) {}

	/** Key down: runs the step once (an error goes to the caller), then repeats it. */
	start(id: string, step: Step): void {
		this.stop(id);
		if (step()) this.schedule(id, step, REPEAT_DELAY_MS);
	}

	/** Key up, or the key left the page. */
	stop(id: string): void {
		clearTimeout(this.timers.get(id));
		this.timers.delete(id);
	}

	private schedule(id: string, step: Step, delayMs: number): void {
		this.timers.set(
			id,
			setTimeout(() => {
				this.timers.delete(id);
				let again = false;
				try {
					again = step();
				} catch (err) {
					this.onError(err);
				}
				if (again) this.schedule(id, step, REPEAT_INTERVAL_MS);
			}, delayMs),
		);
	}
}
