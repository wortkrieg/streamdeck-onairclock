export interface WallTime {
	year: number;
	month: number; // 1-12
	day: number;
	hour: number; // 0-23
	minute: number;
	second: number;
	ms: number;
}

export type ZoneSetting =
	| { kind: "system" }
	| { kind: "iana"; zone: string }
	| { kind: "offset"; minutes: number };

/** UTC offsets from -12:00 to +14:00 in 15-minute steps. */
export const OFFSET_STEPS: readonly number[] = Array.from(
	{ length: 105 },
	(_, i) => -720 + i * 15,
);

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
	let f = formatters.get(zone);
	if (!f) {
		f = new Intl.DateTimeFormat("en-US", {
			timeZone: zone,
			hourCycle: "h23",
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
		});
		formatters.set(zone, f);
	}
	return f;
}

export function isValidIanaZone(zone: string): boolean {
	try {
		formatterFor(zone);
		return true;
	} catch {
		return false;
	}
}

function fromUtcGetters(d: Date, ms: number): WallTime {
	return {
		year: d.getUTCFullYear(),
		month: d.getUTCMonth() + 1,
		day: d.getUTCDate(),
		hour: d.getUTCHours(),
		minute: d.getUTCMinutes(),
		second: d.getUTCSeconds(),
		ms,
	};
}

export function wallTime(nowMs: number, zone: ZoneSetting): WallTime {
	const ms = ((nowMs % 1000) + 1000) % 1000;
	switch (zone.kind) {
		case "system": {
			const d = new Date(nowMs);
			return {
				year: d.getFullYear(),
				month: d.getMonth() + 1,
				day: d.getDate(),
				hour: d.getHours(),
				minute: d.getMinutes(),
				second: d.getSeconds(),
				ms,
			};
		}
		case "offset":
			return fromUtcGetters(new Date(nowMs + zone.minutes * 60000), ms);
		case "iana": {
			const parts: Record<string, number> = {};
			for (const p of formatterFor(zone.zone).formatToParts(nowMs)) {
				if (p.type !== "literal") parts[p.type] = Number(p.value);
			}
			return {
				year: parts.year ?? 0,
				month: parts.month ?? 0,
				day: parts.day ?? 0,
				hour: (parts.hour ?? 0) % 24,
				minute: parts.minute ?? 0,
				second: parts.second ?? 0,
				ms,
			};
		}
	}
}
