/** At most one message per key in this window. */
export const LOG_WINDOW_MS = 10_000;

/**
 * Logs at most one message per key and window, so a failure that repeats on every
 * frame (up to FAST_FPS times a second) does not flood the log. The next message
 * after a quiet window says how many were left out.
 */
export class ThrottledLog {
	private readonly keys = new Map<string, { at: number; suppressed: number }>();

	constructor(
		private readonly log: (message: string) => void,
		private readonly windowMs = LOG_WINDOW_MS,
	) {}

	warn(key: string, message: string, nowMs: number): void {
		const k = this.keys.get(key);
		// A clock that jumped back starts a new window.
		if (k && nowMs >= k.at && nowMs - k.at < this.windowMs) {
			k.suppressed++;
			return;
		}
		const suffix = k?.suppressed ? ` (${k.suppressed} similar suppressed)` : "";
		this.keys.set(key, { at: nowMs, suppressed: 0 });
		this.log(message + suffix);
	}
}
