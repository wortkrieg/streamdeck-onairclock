import type { DateFormat } from "./format";
import { isValidIanaZone, OFFSET_STEPS, type ZoneSetting } from "./time";

export type FaceId = "classic" | "modern" | "line" | "comet" | "big";
export type EndMode = "overtime" | "hold" | "clock";

export interface ClockConfig {
	face: FaceId;
	showDate: boolean;
	showSeconds: boolean;
	dateFormat: DateFormat;
	hour12: boolean;
	pmIndicator: boolean;
	colors: { active: string; inactive: string; background: string };
	zone: ZoneSetting;
	label: string;
	animations: boolean;
	blinkColon: boolean;
	showCountdown: boolean;
}

export interface CountdownConfig {
	durationSec: number;
	endMode: EndMode;
	warn: boolean;
	color: string;
}

/** Stored per-key settings (written by the PI). V1 keys keep their names. */
export type ClockSettingsStored = Partial<{
	face: FaceId;
	showDate: boolean;
	showSeconds: boolean;
	dateType: string;
	hourFormat: string;
	ampmindicator: boolean | string;
	dotcolor: string;
	inactivecolor: string;
	backgroundcolor: string;
	timezone: string; // "system" | "fixed" | IANA
	utcOffset: string; // minutes as string, e.g. "-420"
	label: string;
	animations: boolean;
	blinkColon: boolean;
	showCountdown: boolean;
}>;
export type CountdownSettingsStored = Partial<{
	duration: string;
	endMode: EndMode;
	warn: boolean;
	color: string;
}>;

export const CLOCK_DEFAULTS: ClockConfig = {
	face: "classic",
	showDate: true,
	showSeconds: true,
	dateFormat: "dd-mm",
	hour12: false,
	pmIndicator: false,
	colors: { active: "#FF3B2F", inactive: "#3D3D3D", background: "#000000" },
	zone: { kind: "system" },
	label: "",
	animations: true,
	blinkColon: true,
	showCountdown: true,
};

export const COUNTDOWN_DEFAULTS: CountdownConfig = {
	durationSec: 300,
	endMode: "overtime",
	warn: false,
	color: "#FF3B2F",
};

const FACES: readonly FaceId[] = ["classic", "modern", "line", "comet", "big"];
const DATE_FORMATS: readonly DateFormat[] = [
	"dd-mm",
	"mm-dd",
	"dd-mm-yy",
	"mm-dd-yy",
	"yy-mm-dd",
];
const END_MODES: readonly EndMode[] = ["overtime", "hold", "clock"];
const HEX_COLOR = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const BOOLEAN_KEYS = [
	"showDate",
	"showSeconds",
	"ampmindicator",
	"animations",
	"blinkColon",
	"showCountdown",
	"warn",
] as const;
const MAX_LABEL = 6;
const MAX_DURATION_SEC = 99 * 60 + 59;

function color(v: unknown, fallback: string): string {
	return typeof v === "string" && HEX_COLOR.test(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
	if (typeof v === "boolean") return v;
	if (v === "true") return true;
	if (v === "false") return false;
	return fallback;
}

function oneOf<T extends string>(
	v: unknown,
	list: readonly T[],
	fallback: T,
): T {
	return typeof v === "string" && (list as readonly string[]).includes(v)
		? (v as T)
		: fallback;
}

function parseZone(timezone: unknown, utcOffset: unknown): ZoneSetting {
	const system: ZoneSetting = { kind: "system" };
	if (typeof timezone !== "string" || timezone === "" || timezone === "system")
		return system;
	if (timezone === "fixed") {
		const s = typeof utcOffset === "number" ? String(utcOffset) : utcOffset;
		if (typeof s !== "string" || !/^-?\d+$/.test(s.trim())) return system;
		const minutes = Number.parseInt(s.trim(), 10);
		return OFFSET_STEPS.includes(minutes)
			? { kind: "offset", minutes }
			: system;
	}
	return isValidIanaZone(timezone) ? { kind: "iana", zone: timezone } : system;
}

function parseLabel(v: unknown): string {
	return typeof v === "string"
		? v.trim().toUpperCase().slice(0, MAX_LABEL)
		: "";
}

function parseDuration(v: unknown): number {
	if (typeof v !== "string") return COUNTDOWN_DEFAULTS.durationSec;
	const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
	if (!m) return COUNTDOWN_DEFAULTS.durationSec;
	const mins = Number(m[1]);
	const secs = Number(m[2]);
	const total = mins * 60 + secs;
	if (secs > 59 || total < 1 || total > MAX_DURATION_SEC)
		return COUNTDOWN_DEFAULTS.durationSec;
	return total;
}

/** V1 watchface index -> face and date/seconds flags. Unknown values behave like "0". */
function mapWatchface(
	v: unknown,
): Pick<ClockSettingsStored, "face" | "showDate" | "showSeconds"> {
	const n =
		typeof v === "number"
			? v
			: typeof v === "string"
				? Number.parseInt(v, 10)
				: Number.NaN;
	switch (n) {
		case 1:
			return { face: "classic", showDate: false, showSeconds: true };
		case 2:
			return { face: "classic", showDate: true, showSeconds: false };
		case 3:
			return { face: "classic", showDate: false, showSeconds: false };
		case 4:
			return { face: "modern", showDate: false, showSeconds: true };
		default:
			return { face: "classic", showDate: true, showSeconds: true };
	}
}

export function migrateV1(raw: Record<string, unknown>): {
	settings: ClockSettingsStored;
	changed: boolean;
} {
	const out: Record<string, unknown> = { ...raw };
	let changed = false;

	if ("watchface" in out) {
		const mapped = mapWatchface(out.watchface);
		delete out.watchface;
		changed = true;
		if (!("face" in out)) Object.assign(out, mapped);
	}
	if ("mynameinput" in out) {
		delete out.mynameinput;
		changed = true;
	}
	for (const key of BOOLEAN_KEYS) {
		const v = out[key];
		if (v === "true" || v === "false") {
			out[key] = v === "true";
			changed = true;
		}
	}
	return { settings: out as ClockSettingsStored, changed };
}

export function normalizeClock(raw: Record<string, unknown>): ClockConfig {
	const d = CLOCK_DEFAULTS;
	return {
		face: oneOf(raw.face, FACES, d.face),
		showDate: bool(raw.showDate, d.showDate),
		showSeconds: bool(raw.showSeconds, d.showSeconds),
		dateFormat: oneOf(raw.dateType, DATE_FORMATS, d.dateFormat),
		hour12: raw.hourFormat === "12" || raw.hourFormat === 12,
		pmIndicator: bool(raw.ampmindicator, d.pmIndicator),
		colors: {
			active: color(raw.dotcolor, d.colors.active),
			inactive: color(raw.inactivecolor, d.colors.inactive),
			background: color(raw.backgroundcolor, d.colors.background),
		},
		zone: parseZone(raw.timezone, raw.utcOffset),
		label: parseLabel(raw.label),
		animations: bool(raw.animations, d.animations),
		blinkColon: bool(raw.blinkColon, d.blinkColon),
		showCountdown: bool(raw.showCountdown, d.showCountdown),
	};
}

export function normalizeCountdown(
	raw: Record<string, unknown>,
): CountdownConfig {
	const d = COUNTDOWN_DEFAULTS;
	return {
		durationSec: parseDuration(raw.duration),
		endMode: oneOf(raw.endMode, END_MODES, d.endMode),
		warn: bool(raw.warn, d.warn),
		color: color(raw.color, d.color),
	};
}
