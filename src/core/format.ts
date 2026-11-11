import type { WallTime } from "./time";

export type DateFormat =
	| "dd-mm"
	| "mm-dd"
	| "dd-mm-yy"
	| "mm-dd-yy"
	| "yy-mm-dd";

export function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

export function formatDate(t: WallTime, f: DateFormat): string {
	const dd = pad2(t.day);
	const mm = pad2(t.month);
	const yy = pad2(t.year % 100);
	switch (f) {
		case "dd-mm":
			return `${dd}-${mm}`;
		case "mm-dd":
			return `${mm}-${dd}`;
		case "dd-mm-yy":
			return `${dd}-${mm}-${yy}`;
		case "mm-dd-yy":
			return `${mm}-${dd}-${yy}`;
		case "yy-mm-dd":
			return `${yy}-${mm}-${dd}`;
	}
}

export function displayHour(hour24: number, hour12: boolean): number {
	if (!hour12) return hour24;
	return hour24 % 12 === 0 ? 12 : hour24 % 12;
}

export function isPm(hour24: number): boolean {
	return hour24 >= 12;
}

export function formatMMSS(totalSeconds: number): string {
	const s = Number.isNaN(totalSeconds)
		? 0
		: Math.min(5999, Math.max(0, Math.floor(totalSeconds)));
	return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

export function formatOffset(minutes: number): string {
	const abs = Math.abs(minutes);
	const sign = minutes < 0 ? "−" : "+";
	return `UTC${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}
