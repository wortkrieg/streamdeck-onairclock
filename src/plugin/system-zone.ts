// Node fixes the local time zone at start-up and does not notice when the user changes
// the system time zone; V1 ran in a browser engine that did. Deleting process.env.TZ
// makes Node re-detect the host zone (checked on Stream Deck's Node 24.22.1). An
// explicitly set TZ pins the zone, so it is left alone.

/** How often clocks on "System time" pick up a changed system time zone. */
export const ZONE_CHECK_MS = 10_000;

export function redetectSystemZone(env: NodeJS.ProcessEnv = process.env): void {
	if (env.TZ === undefined) delete env.TZ;
}

/** Re-detects the system time zone every ZONE_CHECK_MS; returns a stop function. */
export function watchSystemZone(
	intervalMs = ZONE_CHECK_MS,
	redetect: () => void = redetectSystemZone,
): () => void {
	const timer = setInterval(redetect, intervalMs);
	timer.unref();
	return () => clearInterval(timer);
}
