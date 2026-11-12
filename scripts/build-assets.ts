// Builds every icon, key image and marketing image ("Farbraum" branding) from the SVG
// sources in assets/brand and the plugin's own face renderer. Deterministic: a fixed
// time, explicit time zones and only the bundled fonts in assets/fonts.
//
//   npm run assets         icons, key images, gallery, README images and GIFs
//   npm run assets:video   the Marketplace gallery video (needs ffmpeg)
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { buildFaceModel } from "../src/core/clock-model";
import {
	type Countdown,
	CountdownRegistry,
	viewCountdown,
} from "../src/core/countdown";
import {
	CLOCK_DEFAULTS,
	type ClockConfig,
	COUNTDOWN_DEFAULTS,
	type CountdownConfig,
	type FaceId,
} from "../src/core/settings";
import { FAST_FPS } from "../src/hardware";
import { ClockController } from "../src/plugin/clock-controller";
import { CountdownController } from "../src/plugin/countdown-controller";
import { combineFrames } from "../src/plugin/ticker";
import { animState, planNextFrame } from "../src/render/animation";
import { renderCountdownKey } from "../src/render/countdown-key";
import { renderFace, STATIC_ANIM } from "../src/render/faces/index";
import { dotRing } from "../src/render/faces/shared";

// gifenc's ESM build only default-exports GIFEncoder; its CJS build has everything, the
// same under tsx and vitest.
const gifenc = createRequire(import.meta.url)(
	"gifenc",
) as typeof import("gifenc");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_DIR = join(ROOT, "assets/brand");
/**
 * Only these fonts are loaded (no system fonts), so the output is the same everywhere.
 * All static TTFs from google/fonts (resvg does not apply variable weight axes), OFL 1.1,
 * licences next to the files.
 */
const FONT_FILES = [
	"Barlow-Regular.ttf",
	"Barlow-Medium.ttf",
	"Barlow-SemiBold.ttf",
	// Broadcast type (Marc: "broadcast-ish"): signage and tally lettering, timecode.
	// google/fonts ofl/barlowcondensed and ofl/ibmplexmono, static TTFs, OFL 1.1.
	"BarlowCondensed-SemiBold.ttf",
	"BarlowCondensed-Bold.ttf",
	"BarlowCondensed-ExtraBold.ttf",
	"IBMPlexMono-Medium.ttf",
	"IBMPlexMono-SemiBold.ttf",
].map((f) => join(ROOT, "assets/fonts", f));

const PLUGIN = "fail.marc.onairclock.sdPlugin";

// ---------- palette and type ----------

export const BRAND = {
	ultramarine: "#2B3BFF",
	paper: "#F2F3FF",
	black: "#000000",
	red: "#FF3B2F",
	mint: "#3DFFB5",
	amber: "#FFA516",
	white: "#F4F4F4",
	blue: "#5B8CFF",
	pink: "#FF5FD2",
} as const;

/** Paper at ~78 % on ultramarine, for supporting text. */
const PAPER_SOFT = "#C9CEFF";
const SHADOW = "#0A1066";
const TEXT = "Barlow";
/** Condensed grotesk for signage, tally and lower-third lettering (always uppercase). */
const COND = "Barlow Condensed";
const MONO = "IBM Plex Mono";
/** On-air tally red, a touch warmer than the clock red so the lamp reads as light. */
const TALLY = "#FF3B2F";
/** Cap heights in em, measured from the bundled fonts. */
const TEXT_CAP = 0.7;

// ---------- time ----------

const BERLIN = "Europe/Berlin";
/** 2026-11-11 10:08:30 in Berlin (CET, UTC+1). */
export const ASSET_TIME_MS = Date.UTC(2026, 10, 11, 9, 8, 30);
/**
 * Stills are taken 400 ms into the second: digit rolls are done, the colon is still on
 * (first 500 ms) and the ring head shows the last afterglow step (0.25 from 300 ms).
 */
const STILL_MS = ASSET_TIME_MS + 400;

// ---------- keys ----------

interface ClockKey {
	kind: "clock";
	face: FaceId;
	color: string;
	label?: string;
	zone?: string;
	showDate?: boolean;
	showSeconds?: boolean;
	/** Separate time color (digits, date, label); the ring keeps `color`. */
	time?: string;
	inactive?: string;
	background?: string;
}
interface CountdownKey {
	kind: "countdown";
	color: string;
	/** ms since the countdown started; > duration means overtime. */
	elapsedMs: number;
	durationSec?: number;
}
type KeySpec = ClockKey | CountdownKey;

const clockKey = (
	face: FaceId,
	color: string,
	extra: Partial<Omit<ClockKey, "kind" | "face" | "color">> = {},
): ClockKey => ({ kind: "clock", face, color, ...extra });

const countdownKey = (
	color: string,
	elapsedMs: number,
	durationSec = 300,
): CountdownKey => ({ kind: "countdown", color, elapsedMs, durationSec });

function clockConfig(k: ClockKey): ClockConfig {
	return {
		...CLOCK_DEFAULTS,
		face: k.face,
		label: k.label ?? "",
		zone: { kind: "iana", zone: k.zone ?? BERLIN },
		showDate: k.showDate ?? CLOCK_DEFAULTS.showDate,
		showSeconds: k.showSeconds ?? CLOCK_DEFAULTS.showSeconds,
		colors: {
			active: k.color,
			inactive: k.inactive ?? CLOCK_DEFAULTS.colors.inactive,
			background: k.background ?? CLOCK_DEFAULTS.colors.background,
			time: k.time ?? k.color,
		},
	};
}

/** The 144x144 key SVG exactly as the plugin would draw it at `nowMs`. */
function keySvg(k: KeySpec, nowMs = STILL_MS): string {
	if (k.kind === "countdown") {
		const durationSec = k.durationSec ?? COUNTDOWN_DEFAULTS.durationSec;
		const c: Countdown = {
			deviceId: "assets",
			sourceActionId: "assets",
			// Started at a fixed time, so it runs on in animations; stills are unchanged.
			startMs: STILL_MS - k.elapsedMs,
			durationMs: durationSec * 1000,
			endMode: "overtime",
			warn: false,
		};
		return renderCountdownKey(viewCountdown(c, nowMs), durationSec, k.color);
	}
	const cfg = clockConfig(k);
	const m = buildFaceModel(nowMs, cfg);
	return renderFace(cfg.face, m, cfg.colors, animState(m, cfg));
}

// ---------- device simulation (animated assets) ----------

const SIM_DEVICE = "sim";

/** The SVG document inside a key's data URI. */
function svgFromDataUri(uri: string): string {
	const comma = uri.indexOf(",");
	const body = uri.slice(comma + 1);
	return uri.slice(0, comma).endsWith(";base64")
		? Buffer.from(body, "base64").toString("utf8")
		: decodeURIComponent(body);
}

/**
 * The plugin's own controllers and frame planning on a simulated clock, so animated
 * assets change exactly when a Stream Deck key would: 10 even frames per second for the
 * sweeping rings, the stepped afterglow on the dot faces, fast frames at the minute
 * change and during a countdown warning.
 */
class DeviceSim {
	private readonly registry = new CountdownRegistry();
	private readonly clocks = new ClockController(this.registry);
	private readonly countdowns = new CountdownController(this.registry);
	private readonly shown = new Map<string, string>();
	private readonly frame = combineFrames({
		clocks: (t) => this.clocks.frame(t),
		countdowns: (t) => this.countdowns.frame(t),
	});
	private next: number;

	constructor(startMs: number) {
		this.next = startMs;
	}

	private target(id: string) {
		return {
			id,
			deviceId: SIM_DEVICE,
			draw: (uri: string) => {
				this.shown.set(id, svgFromDataUri(uri));
				return Promise.resolve();
			},
		};
	}

	addClock(id: string, k: ClockKey): void {
		this.clocks.add({ ...this.target(id), kind: "key" }, clockConfig(k));
	}

	addCountdown(id: string, cfg: CountdownConfig): void {
		this.countdowns.add(this.target(id), cfg);
	}

	/** Changes a clock's settings at `nowMs`, like the property inspector would. */
	setClock(id: string, k: ClockKey, nowMs: number): void {
		this.advanceTo(nowMs);
		this.clocks.update(id, clockConfig(k));
		this.tick(nowMs);
	}

	/** A key press on a countdown key at `nowMs`; the ticker is kicked like in the plugin. */
	press(id: string, nowMs: number): void {
		this.advanceTo(nowMs);
		this.countdowns.press(id, nowMs);
		this.tick(nowMs);
	}

	/** Runs every frame the plugin's ticker would run up to `nowMs`. */
	advanceTo(nowMs: number): void {
		while (this.next <= nowMs) this.tick(this.next);
	}

	private tick(nowMs: number): void {
		const r = this.frame(nowMs);
		this.next = nowMs + planNextFrame(nowMs, r.phasesMs, r.fast, FAST_FPS);
	}

	/** The image the key shows after the last simulated frame. */
	svg(id: string): string {
		return this.shown.get(id) ?? "";
	}
}

// ---------- svg primitives ----------

const n2 = (v: number): string => String(Math.round(v * 100) / 100);

function esc(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

interface TextOptions {
	family: string;
	weight: number;
	size: number;
	fill: string;
	anchor?: "start" | "middle" | "end";
	/** Tracking in em. */
	tracking?: number;
}

function text(s: string, x: number, y: number, o: TextOptions): string {
	const ls = o.tracking ? ` letter-spacing="${n2(o.tracking * o.size)}"` : "";
	const anchor =
		o.anchor && o.anchor !== "start" ? ` text-anchor="${o.anchor}"` : "";
	return `<text x="${n2(x)}" y="${n2(y)}" font-family="${o.family}" font-weight="${o.weight}" font-size="${o.size}" fill="${o.fill}"${anchor}${ls}>${esc(s)}</text>`;
}

/** Give a face SVG's ids a prefix so several keys can share one document. */
function scopeIds(svg: string, prefix: string): string {
	return svg
		.replace(/id="([^"]+)"/g, `id="${prefix}-$1"`)
		.replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`);
}

let keyCounter = 0;

/** Soft shadow that lifts the black keys off the ultramarine. */
function shadowFilter(size: number): string {
	return `<filter id="key-shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n2(size * 0.07)}"/></filter>`;
}

/**
 * A Stream Deck key: black rounded square (radius 14 %) with the face inside, clipped to
 * the key like the real LCD.
 */
function keyAt(
	x: number,
	y: number,
	size: number,
	face: string,
	shadow = true,
): string {
	const id = `k${keyCounter++}`;
	const rx = n2(size * 0.14);
	const box = `x="${n2(x)}" y="${n2(y)}" width="${n2(size)}" height="${n2(size)}"`;
	const inner = scopeIds(face, id).replace(
		/^<svg[^>]*>/,
		`<svg ${box} viewBox="0 0 144 144">`,
	);
	const lift = shadow
		? `<rect x="${n2(x)}" y="${n2(y + size * 0.05)}" width="${n2(size)}" height="${n2(size)}" rx="${rx}" fill="${SHADOW}" opacity=".45" filter="url(#key-shadow)"/>`
		: "";
	return `${lift}<clipPath id="${id}-clip"><rect ${box} rx="${rx}"/></clipPath><rect ${box} rx="${rx}" fill="${BRAND.black}"/><g clip-path="url(#${id}-clip)">${inner}</g>`;
}

function page(
	w: number,
	h: number,
	body: string,
	defs = "",
	bg: string = BRAND.ultramarine,
): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`;
}

// ---------- rasterising ----------

function resvg(svg: string, width?: number): Resvg {
	return new Resvg(svg, {
		fitTo: width ? { mode: "width", value: width } : { mode: "original" },
		font: {
			fontFiles: FONT_FILES,
			loadSystemFonts: false,
			defaultFontFamily: TEXT,
		},
		textRendering: 2,
		logLevel: "off",
	});
}

function png(svg: string, width?: number): Buffer {
	return resvg(svg, width).render().asPng();
}

// ---------- compositions ----------

/** Clock palette: ring colours and the time colours they pair with. */
const CYAN = "#32D5FF";
const WHITE = "#FFFFFF";
const YELLOW = "#FFE600";
const PURPLE = "#BF5AF2";
const NAVY = "#1B1464";

/**
 * Ring and time colour pairs shown as swatches: an outer ring in the ring colour, a dot
 * in the time colour. Since V2 the two can differ, which is the point of the swatches.
 */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
	[BRAND.red, BRAND.red],
	[CYAN, WHITE],
	[BRAND.pink, CYAN],
	[BRAND.amber, WHITE],
	[BRAND.mint, YELLOW],
	[PURPLE, WHITE],
];

/**
 * Hero grid, row by row: every face, many colours, ring and time apart on all keys but
 * the first (the classic red default), a world clock, a countdown.
 */
const HERO_KEYS: readonly KeySpec[] = [
	clockKey("classic", BRAND.red),
	clockKey("big", BRAND.mint, { time: WHITE }),
	clockKey("comet", BRAND.pink, { time: CYAN }),
	clockKey("line", CYAN, { time: WHITE }),
	clockKey("line", BRAND.blue, {
		time: BRAND.amber,
		label: "NYC",
		zone: "America/New_York",
	}),
	clockKey("modern", BRAND.pink, { time: WHITE }),
	countdownKey(BRAND.mint, 195_400),
	clockKey("classic", WHITE, {
		time: YELLOW,
		inactive: "#5560B0",
		background: NAVY,
		label: "TYO",
		zone: "Asia/Tokyo",
	}),
	clockKey("big", BRAND.red, { time: WHITE }),
	clockKey("comet", BRAND.mint, { time: BRAND.amber }),
	clockKey("modern", BRAND.amber, { time: WHITE }),
	clockKey("line", PURPLE, { time: YELLOW }),
];

/** 3x2 for the social preview: the default once, the other keys in pairs. */
const SOCIAL_KEYS: readonly KeySpec[] = [
	clockKey("classic", BRAND.red),
	clockKey("big", BRAND.mint, { time: WHITE }),
	clockKey("comet", BRAND.pink, { time: CYAN }),
	clockKey("line", BRAND.blue, {
		time: BRAND.amber,
		label: "NYC",
		zone: "America/New_York",
	}),
	clockKey("modern", BRAND.amber, { time: WHITE }),
	clockKey("line", PURPLE, { time: YELLOW }),
];

interface HeroLayout {
	w: number;
	h: number;
	margin: number;
	cols: number;
	rows: number;
	key: number;
	gap: number;
	nameSize: number;
	claimSize: number;
	keys: readonly KeySpec[];
}

const CLAIM = "Studio clocks in any color, on any key.";

/** Ink width of one text line as resvg sets it (for layout and fitting). */
function textWidth(s: string, o: TextOptions): number {
	const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="6000" height="${Math.ceil(o.size * 2)}">${text(s, 0, o.size * 1.4, { ...o, anchor: "start" })}</svg>`;
	const b = resvg(probe).getBBox();
	return b ? b.x + b.width : 0;
}

/** `o.size`, or smaller so that every line fits `maxW`. */
function fitSize(
	lines: readonly string[],
	o: TextOptions,
	maxW: number,
): number {
	const widest = Math.max(...lines.map((l) => textWidth(l, o)));
	return widest > maxW ? Math.floor((o.size * maxW) / widest) : o.size;
}

interface HeroGrid {
	body: string;
	x0: number;
	y0: number;
	gw: number;
	gh: number;
	/** Width of the text column left of the grid. */
	colW: number;
}

/** The key grid on the right; the text column takes the space left of it. */
function heroGrid(l: HeroLayout, nowMs: number): HeroGrid {
	keyCounter = 0;
	const gw = l.cols * l.key + (l.cols - 1) * l.gap;
	const gh = l.rows * l.key + (l.rows - 1) * l.gap;
	const x0 = l.w - l.margin - gw;
	const y0 = (l.h - gh) / 2;
	let body = "";
	l.keys.slice(0, l.cols * l.rows).forEach((k, i) => {
		const c = i % l.cols;
		const r = Math.floor(i / l.cols);
		body += keyAt(
			x0 + c * (l.key + l.gap),
			y0 + r * (l.key + l.gap),
			l.key,
			keySvg(k, nowMs),
		);
	});
	return { body, x0, y0, gw, gh, colW: x0 - l.margin - l.gap * 2.4 };
}

/** Ring/time swatches along `y` (centre line), from `x`. */
function pairSwatches(x: number, y: number, d: number): string {
	const step = d * 1.75;
	return PAIRS.map(([ring, time], i) => {
		const cx = n2(x + d / 2 + i * step);
		return `<circle cx="${cx}" cy="${n2(y)}" r="${n2(d / 2 - d * 0.08)}" fill="none" stroke="${ring}" stroke-width="${n2(d * 0.16)}"/><circle cx="${cx}" cy="${n2(y)}" r="${n2(d * 0.2)}" fill="${time}"/>`;
	}).join("");
}

/**
 * Hero A, signage: "ON AIR" over "CLOCK" in condensed extra-bold capitals with tight
 * signage leading, the claim under it, ring/time swatches on the grid's bottom line.
 * Type only (Marc: no red plate behind "ON AIR").
 */
function heroTally(l: HeroLayout, nowMs = STILL_MS): string {
	const g = heroGrid(l, nowMs);
	const word: TextOptions = {
		family: COND,
		weight: 800,
		size: l.nameSize * 1.12,
		fill: BRAND.paper,
		tracking: 0.06,
	};
	word.size = fitSize(["ON AIR", "CLOCK"], word, g.colW);
	const cap = word.size * TEXT_CAP;
	const leading = word.size * 0.2;
	// Optical alignment: the condensed O and C overshoot the left edge a little.
	const x = l.margin - word.size * 0.01;
	const onAirBase = g.y0 + cap;
	let body = g.body;
	body += text("ON AIR", x, onAirBase, word);
	const clockBase = onAirBase + leading + cap;
	body += text("CLOCK", x, clockBase, word);
	const claim: TextOptions = {
		family: TEXT,
		weight: 500,
		size: l.claimSize,
		fill: PAPER_SOFT,
	};
	const c1 = clockBase + word.size * 0.42 + l.claimSize * TEXT_CAP;
	body += text("Studio clocks in any color,", l.margin, c1, claim);
	body += text("on any key.", l.margin, c1 + l.claimSize * 1.3, claim);
	const d = l.claimSize * 0.66;
	body += pairSwatches(l.margin, g.y0 + g.gh - d / 2, d);
	return page(l.w, l.h, body, shadowFilter(l.key));
}

/**
 * Hero B, lower third: title-safe corner marks, a timecode readout with a red tally dot,
 * and the name as a two-tier lower third (white name plate, dark claim plate, red bar).
 */
function heroLowerThird(l: HeroLayout, nowMs = STILL_MS): string {
	const g = heroGrid(l, nowMs);
	let body = g.body;
	// Title-safe corners (5 % inset), as on a broadcast monitor.
	const inset = Math.round(l.h * 0.05);
	const arm = Math.round(l.h * 0.05);
	const corner = (x: number, y: number, dx: number, dy: number) =>
		`<path d="M${x} ${y + dy * arm}V${y}H${x + dx * arm}" fill="none" stroke="${PAPER_SOFT}" stroke-opacity=".55" stroke-width="3"/>`;
	body += corner(inset, inset, 1, 1);
	body += corner(l.w - inset, inset, -1, 1);
	body += corner(inset, l.h - inset, 1, -1);
	body += corner(l.w - inset, l.h - inset, -1, -1);

	// Timecode: red tally dot, then HH:MM:SS:FF in mono, cap top on the grid's top.
	const tc: TextOptions = {
		family: MONO,
		weight: 600,
		size: l.nameSize * 0.56,
		fill: BRAND.paper,
		tracking: 0.02,
	};
	const tcCap = tc.size * TEXT_CAP;
	const dot = tc.size * 0.36;
	body += `<circle cx="${n2(l.margin + dot / 2)}" cy="${n2(g.y0 + tcCap / 2)}" r="${n2(dot / 2)}" fill="${TALLY}"/>`;
	body += `<circle cx="${n2(l.margin + dot / 2)}" cy="${n2(g.y0 + tcCap / 2)}" r="${n2(dot)}" fill="${TALLY}" opacity=".35" filter="url(#lt-glow)"/>`;
	body += text("10:08:30:00", l.margin + dot * 1.9, g.y0 + tcCap, tc);
	body += text(
		"TIMECODE",
		l.margin + dot * 1.9,
		g.y0 + tcCap + tc.size * 0.95,
		{
			family: MONO,
			weight: 500,
			size: tc.size * 0.34,
			fill: PAPER_SOFT,
			tracking: 0.18,
		},
	);

	// Lower third on the grid's bottom line: name plate over claim plate, red bar left.
	const name: TextOptions = {
		family: COND,
		weight: 800,
		size: l.nameSize * 0.92,
		fill: "#0A1066",
		tracking: 0.04,
	};
	const bar = Math.round(l.nameSize * 0.11);
	const padX = l.nameSize * 0.2;
	name.size = fitSize(["ON AIR CLOCK"], name, g.colW - bar - 2 * padX);
	const claim: TextOptions = {
		family: TEXT,
		weight: 500,
		size: l.claimSize,
		fill: BRAND.paper,
	};
	claim.size = fitSize([CLAIM], claim, g.colW - bar - 2 * padX);
	const nameCap = name.size * TEXT_CAP;
	const namePlateH = nameCap + name.size * 0.42;
	const claimPlateH = claim.size * TEXT_CAP + claim.size * 0.95;
	const bottom = g.y0 + g.gh;
	const top = bottom - namePlateH - claimPlateH;
	const nameW = textWidth("ON AIR CLOCK", name) + 2 * padX;
	const claimW = textWidth(CLAIM, claim) + 2 * padX;
	body += `<rect x="${l.margin}" y="${n2(top)}" width="${bar}" height="${n2(namePlateH + claimPlateH)}" fill="${TALLY}"/>`;
	body += `<rect x="${l.margin + bar}" y="${n2(top)}" width="${n2(nameW)}" height="${n2(namePlateH)}" fill="${BRAND.paper}"/>`;
	body += `<rect x="${l.margin + bar}" y="${n2(top + namePlateH)}" width="${n2(claimW)}" height="${n2(claimPlateH)}" fill="#0A1066"/>`;
	body += text(
		"ON AIR CLOCK",
		l.margin + bar + padX,
		top + (namePlateH + nameCap) / 2,
		name,
	);
	body += text(
		CLAIM,
		l.margin + bar + padX,
		top + namePlateH + (claimPlateH + claim.size * TEXT_CAP) / 2,
		claim,
	);
	const glow = `<filter id="lt-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${n2(dot * 0.5)}"/></filter>`;
	return page(l.w, l.h, body, shadowFilter(l.key) + glow);
}

/**
 * Hero C, studio sign: a plaque between two rules, mono labels above, "ON AIR / CLOCK"
 * in large condensed capitals with a lit lamp, the claim below the lower rule.
 */
function heroSign(l: HeroLayout, nowMs = STILL_MS): string {
	const g = heroGrid(l, nowMs);
	let body = g.body;
	const label: TextOptions = {
		family: MONO,
		weight: 500,
		size: l.claimSize * 0.5,
		fill: PAPER_SOFT,
		tracking: 0.2,
	};
	const labelCap = label.size * TEXT_CAP;
	const right = l.margin + g.colW;
	body += text("STUDIO CLOCK", l.margin, g.y0 + labelCap, label);
	// Flush right by measured width (tracking adds no space after the last letter).
	body += text(
		"STREAM DECK",
		right - textWidth("STREAM DECK", label),
		g.y0 + labelCap,
		label,
	);
	const rule = (y: number) =>
		`<rect x="${l.margin}" y="${n2(y)}" width="${n2(g.colW)}" height="3" fill="${BRAND.paper}"/>`;
	const rule1 = g.y0 + labelCap + label.size * 0.7;
	body += rule(rule1);

	const word: TextOptions = {
		family: COND,
		weight: 800,
		size: l.nameSize * 1.55,
		fill: BRAND.paper,
		tracking: 0.01,
	};
	const lamp = l.nameSize * 0.42;
	word.size = fitSize(["ON AIR", "CLOCK"], word, g.colW - lamp * 1.6);
	const cap = word.size * TEXT_CAP;
	const line1 = rule1 + word.size * 0.22 + cap;
	const line2 = line1 + cap + word.size * 0.14;
	body += text("ON AIR", l.margin, line1, word);
	body += text("CLOCK", l.margin, line2, word);
	// The lamp sits at the right end of the "ON AIR" line.
	const lx = right - lamp / 2;
	const ly = line1 - cap / 2;
	body += `<circle cx="${n2(lx)}" cy="${n2(ly)}" r="${n2(lamp)}" fill="${TALLY}" opacity=".45" filter="url(#sign-glow)"/><circle cx="${n2(lx)}" cy="${n2(ly)}" r="${n2(lamp / 2)}" fill="${TALLY}"/><circle cx="${n2(lx - lamp * 0.14)}" cy="${n2(ly - lamp * 0.14)}" r="${n2(lamp * 0.14)}" fill="#FFFFFF" opacity=".55"/>`;
	const rule2 = line2 + word.size * 0.2;
	body += rule(rule2);
	const claim: TextOptions = {
		family: TEXT,
		weight: 500,
		size: l.claimSize,
		fill: PAPER_SOFT,
	};
	claim.size = fitSize([CLAIM], claim, g.colW);
	body += text(
		CLAIM,
		l.margin,
		rule2 + claim.size * 0.7 + claim.size * TEXT_CAP,
		claim,
	);
	const d = l.claimSize * 0.66;
	body += pairSwatches(l.margin, g.y0 + g.gh - d / 2, d);
	const glow = `<filter id="sign-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${n2(lamp * 0.35)}"/></filter>`;
	return page(l.w, l.h, body, shadowFilter(l.key) + glow);
}

/** The Marketplace gallery hero and thumbnail (1920x960). */
export const GALLERY_HERO: HeroLayout = {
	w: 1920,
	h: 960,
	margin: 120,
	cols: 4,
	rows: 3,
	key: 220,
	gap: 30,
	nameSize: 150,
	claimSize: 46,
	keys: HERO_KEYS,
};

export const HERO_VARIANTS = {
	a: heroTally,
	b: heroLowerThird,
	c: heroSign,
} as const;
/** The variant used for the gallery hero, the README hero and the social preview. */
export const HERO_CHOICE: keyof typeof HERO_VARIANTS = "a";

function hero(l: HeroLayout, nowMs = STILL_MS): string {
	return HERO_VARIANTS[HERO_CHOICE](l, nowMs);
}

interface RowLayout {
	heading: string;
	support: string;
	keys: readonly KeySpec[];
	captions: readonly string[];
	key: number;
	/** Draw a thin arrow in each gap (a sequence in time). */
	arrows?: boolean;
}

const G_W = 1920;
const G_H = 960;
const G_MARGIN = 120;
const G_HEAD = 80;
const G_SUPPORT = 40;
const G_CAPTION = 34;
/** Barlow descender in em (for optical spacing below a text line). */
const TEXT_DESC = 0.2;

/** A gallery row with the keys as still images. */
function row(l: RowLayout): string {
	return rowPage(
		l,
		l.keys.map((k) => keySvg(k)),
		G_H,
	);
}

/**
 * Heading and supporting line top left on the margin, one row of keys (`svgs`, one per
 * key) spanning the width with captions below; equal space above and below the row.
 */
function rowPage(l: RowLayout, svgs: readonly string[], h: number): string {
	keyCounter = 0;
	const headBase = G_MARGIN + G_HEAD * 1.1 * TEXT_CAP;
	const supportBase = headBase + 72;
	// Condensed capitals like the hero's lamp lettering (broadcast signage).
	let body = text(l.heading.toUpperCase(), G_MARGIN - G_HEAD * 0.01, headBase, {
		family: COND,
		weight: 800,
		size: G_HEAD * 1.1,
		fill: BRAND.paper,
		tracking: 0.03,
	});
	body += text(l.support, G_MARGIN - G_SUPPORT * 0.047, supportBase, {
		family: TEXT,
		weight: 500,
		size: G_SUPPORT,
		fill: PAPER_SOFT,
	});

	const count = svgs.length;
	const span = G_W - 2 * G_MARGIN;
	const gap = count > 1 ? (span - count * l.key) / (count - 1) : 0;
	const captionGap = 44;
	const blockH = l.key + captionGap + G_CAPTION * (TEXT_CAP + TEXT_DESC);
	const top = supportBase + G_SUPPORT * TEXT_DESC;
	const y = (top + h - blockH) / 2;
	svgs.forEach((svg, i) => {
		const x = G_MARGIN + i * (l.key + gap);
		body += keyAt(x, y, l.key, svg);
		const caption = l.captions[i];
		if (caption)
			body += text(
				caption,
				x + l.key / 2,
				y + l.key + captionGap + G_CAPTION * TEXT_CAP,
				{
					family: TEXT,
					weight: 600,
					size: G_CAPTION,
					fill: BRAND.paper,
					anchor: "middle",
				},
			);
		if (l.arrows && i < count - 1) {
			const ax0 = x + l.key + gap * 0.3;
			const ax1 = x + l.key + gap * 0.7;
			const ay = y + l.key / 2;
			const hw = 14;
			body += `<g fill="none" stroke="${PAPER_SOFT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M${n2(ax0)} ${n2(ay)}H${n2(ax1)}"/><path d="M${n2(ax1 - hw)} ${n2(ay - hw)}L${n2(ax1)} ${n2(ay)}L${n2(ax1 - hw)} ${n2(ay + hw)}"/></g>`;
		}
	});
	return page(G_W, h, body, shadowFilter(l.key));
}

const FACES_ROW: RowLayout = {
	heading: "Five watchfaces",
	support: "Pick one per key, in any color.",
	keys: [
		clockKey("classic", BRAND.red),
		clockKey("modern", PURPLE, { time: WHITE }),
		clockKey("line", CYAN, { time: YELLOW }),
		clockKey("comet", BRAND.amber, { time: WHITE }),
		clockKey("big", BRAND.pink, { time: WHITE }),
	],
	captions: ["Classic", "Modern Minimal", "Line", "Comet", "Big"],
	key: 304,
};

const ZONES_ROW: RowLayout = {
	heading: "World clocks with time zones",
	support: "Any IANA zone or a fixed UTC offset.",
	keys: [
		clockKey("classic", CYAN, {
			time: WHITE,
			label: "BER",
			zone: "Europe/Berlin",
		}),
		clockKey("line", BRAND.amber, {
			time: WHITE,
			label: "NYC",
			zone: "America/New_York",
		}),
		clockKey("modern", BRAND.mint, {
			time: YELLOW,
			label: "TYO",
			zone: "Asia/Tokyo",
		}),
		clockKey("line", BRAND.pink, {
			time: WHITE,
			label: "LDN",
			zone: "Europe/London",
		}),
		clockKey("classic", PURPLE, {
			time: WHITE,
			label: "SYD",
			zone: "Australia/Sydney",
		}),
	],
	captions: ["Berlin", "New York", "Tokyo", "London", "Sydney"],
	key: 304,
};

const COUNTDOWN_ROW: RowLayout = {
	heading: "Countdown with overtime",
	support: "One press to start. Overtime counts up.",
	keys: [
		countdownKey(BRAND.mint, 400), // 05:00, just started
		countdownKey(BRAND.amber, 290_400), // 00:10 left
		countdownKey(BRAND.red, 312_400), // +00:12 over
	],
	captions: ["Start", "Final seconds", "Overtime"],
	key: 400,
	arrows: true,
};

const COLORS_ROW: RowLayout = {
	heading: "Unlimited color combinations",
	support: "Ring, time, dots and background, each in any color.",
	keys: [
		clockKey("classic", BRAND.red, { time: WHITE }),
		clockKey("modern", CYAN, { time: WHITE }),
		clockKey("line", WHITE, {
			time: YELLOW,
			inactive: "#E0606F",
			background: "#B00020",
		}),
		clockKey("comet", BRAND.pink, { time: CYAN }),
		clockKey("big", BRAND.mint, { time: WHITE }),
	],
	captions: [
		"Red and white",
		"Cyan and white",
		"White and yellow",
		"Pink and cyan",
		"Mint and white",
	],
	key: 304,
};

// ---------- animations (GIFs and video) ----------

/** The plugin's fast frame interval: one GIF frame per device frame at 10 fps. */
const FRAME_MS = Math.round(1000 / FAST_FPS);
/**
 * Frames are sampled 400 ms into the second, like the stills: the first frame (the
 * poster where GIFs do not play) has settled digits and its colon on. The device draws
 * 5 ms after each 100 ms step, so every sample still shows exactly one new device frame.
 */
const SAMPLE_OFFSET_MS = 400;
/** 10:08:56 in Berlin: four seconds before the minute change to 10:09. */
const BEFORE_MINUTE_MS = ASSET_TIME_MS + 26_000;

interface Frames {
	frames: Uint8Array[];
	w: number;
	h: number;
}

/** Rasterises `count` frames; identical documents are rendered once. */
function renderFrames(count: number, svgAt: (i: number) => string): Frames {
	const cache = new Map<string, Uint8Array>();
	let w = 0;
	let h = 0;
	const frames: Uint8Array[] = [];
	for (let i = 0; i < count; i++) {
		const svg = svgAt(i);
		let px = cache.get(svg);
		if (!px) {
			const img = resvg(svg).render();
			w = img.width;
			h = img.height;
			px = img.pixels;
			cache.set(svg, px);
		}
		frames.push(px);
	}
	return { frames, w, h };
}

/**
 * A looping GIF: one palette for all frames (no colour flicker), and every pixel that
 * did not change since the previous frame is transparent, so the frames stay small.
 */
function encodeGif({ frames, w, h }: Frames, delayMs: number): Buffer {
	const frameBytes = w * h * 4;
	const every = Math.max(1, Math.floor(frames.length / 16));
	const picked = frames.filter((_, i) => i % every === 0);
	const sample = new Uint8Array(picked.length * frameBytes);
	for (const [i, f] of picked.entries()) sample.set(f, i * frameBytes);
	const base = gifenc.quantize(sample, 255);
	const clear = base.length;
	const palette = [...base, [255, 0, 255]];
	const gif = gifenc.GIFEncoder();
	let shown: Uint8Array | undefined;
	for (const [i, f] of frames.entries()) {
		const index = gifenc.applyPalette(f, base);
		if (shown) {
			for (let p = 0; p < index.length; p++) {
				if (index[p] === shown[p]) index[p] = clear;
				else shown[p] = index[p] ?? 0;
			}
		} else shown = index.slice();
		gif.writeFrame(index, w, h, {
			palette: i === 0 ? palette : undefined,
			delay: delayMs,
			transparent: i > 0,
			transparentIndex: clear,
			dispose: 1,
		});
	}
	gif.finish();
	return Buffer.from(gif.bytes());
}

interface StripLayout {
	key: number;
	gap: number;
	pad: number;
	captions?: readonly string[];
}
const STRIP_CAPTION = 22;
const STRIP_CAPTION_GAP = 18;

/** A row of keys on the ultramarine stage (GIFs), optional captions below. */
function stripPage(svgs: readonly string[], l: StripLayout): string {
	keyCounter = 0;
	const n = svgs.length;
	const w = 2 * l.pad + n * l.key + (n - 1) * l.gap;
	const cap = l.captions
		? STRIP_CAPTION_GAP + STRIP_CAPTION * (TEXT_CAP + TEXT_DESC)
		: 0;
	const h = 2 * l.pad + l.key + cap;
	let body = "";
	svgs.forEach((svg, j) => {
		const x = l.pad + j * (l.key + l.gap);
		body += keyAt(x, l.pad, l.key, svg, false);
		const caption = l.captions?.[j];
		if (caption)
			body += text(
				caption,
				x + l.key / 2,
				l.pad + l.key + STRIP_CAPTION_GAP + STRIP_CAPTION * TEXT_CAP,
				{
					family: TEXT,
					weight: 600,
					size: STRIP_CAPTION,
					fill: BRAND.paper,
					anchor: "middle",
				},
			);
	});
	return page(w, h, body);
}

/** One animated sequence: keys in a simulated device, sampled every `stepMs`. */
interface Sequence {
	startMs: number;
	durationMs: number;
	ids: readonly string[];
	sim: DeviceSim;
	/** Presses and setting changes, at ms after the start. */
	events?: ReadonlyArray<[number, (sim: DeviceSim, nowMs: number) => void]>;
}

/** The key images of `seq` at `atMs` after its start (events applied in order). */
function sequenceAt(seq: Sequence, atMs: number, done: Set<number>): string[] {
	const now = seq.startMs + SAMPLE_OFFSET_MS + atMs;
	for (const [i, [at, run]] of (seq.events ?? []).entries()) {
		if (!done.has(i) && at <= atMs) {
			run(seq.sim, seq.startMs + at);
			done.add(i);
		}
	}
	seq.sim.advanceTo(now);
	return seq.ids.map((id) => seq.sim.svg(id));
}

/** A GIF of `seq` at the device frame rate. */
function sequenceGif(seq: Sequence, layout: StripLayout): Buffer {
	const done = new Set<number>();
	const count = Math.round(seq.durationMs / FRAME_MS);
	return encodeGif(
		renderFrames(count, (i) =>
			stripPage(sequenceAt(seq, i * FRAME_MS, done), layout),
		),
		FRAME_MS,
	);
}

/** Clocks with ids k0.., in a fresh simulated device starting at `startMs`. */
function clockSim(keys: readonly ClockKey[], startMs: number): DeviceSim {
	const sim = new DeviceSim(startMs);
	keys.forEach((k, i) => {
		sim.addClock(`k${i}`, k);
	});
	return sim;
}
const ids = (n: number): string[] =>
	Array.from({ length: n }, (_, i) => `k${i}`);

const FACE_KEYS: readonly ClockKey[] = [
	clockKey("classic", BRAND.red),
	clockKey("modern", PURPLE, { time: WHITE }),
	clockKey("line", CYAN, { time: YELLOW }),
	clockKey("comet", BRAND.amber, { time: WHITE }),
	clockKey("big", BRAND.pink, { time: WHITE }),
];
const FACE_NAMES = ["Classic", "Modern", "Line", "Comet", "Big"];

/** The five faces from 10:08:56 across the minute change (digit roll, ring reset). */
function facesSequence(durationMs: number): Sequence {
	return {
		startMs: BEFORE_MINUTE_MS,
		durationMs,
		ids: ids(FACE_KEYS.length),
		sim: clockSim(FACE_KEYS, BEFORE_MINUTE_MS),
	};
}

const COUNTDOWN_CLOCKS: readonly ClockKey[] = [
	clockKey("classic", CYAN, { time: WHITE }),
	clockKey("line", PURPLE, { time: YELLOW }),
	clockKey("big", BRAND.mint, { time: WHITE }),
];

/**
 * Countdown key and three clocks: idle, a press, the clocks switch to the countdown,
 * the warning pulse in the last 10 s, zero, overtime.
 */
function countdownSequence(durationSec: number, overtimeMs: number): Sequence {
	const startMs = ASSET_TIME_MS;
	const sim = clockSim(COUNTDOWN_CLOCKS, startMs);
	sim.addCountdown("cd", {
		durationSec,
		endMode: "overtime",
		warn: true,
		color: BRAND.amber,
	});
	const pressAt = 1000;
	return {
		startMs,
		durationMs: pressAt + durationSec * 1000 + overtimeMs,
		ids: ["cd", ...ids(COUNTDOWN_CLOCKS.length)],
		sim,
		events: [[pressAt, (s, now) => s.press("cd", now)]],
	};
}

/** Ring and time color combinations per face, switched every `stepMs`. */
const COMBOS: ReadonlyArray<readonly ClockKey[]> = [
	[
		clockKey("classic", BRAND.red, { time: WHITE }),
		clockKey("modern", CYAN, { time: WHITE }),
		clockKey("line", BRAND.amber, { time: WHITE }),
		clockKey("comet", BRAND.pink, { time: CYAN }),
		clockKey("big", BRAND.mint, { time: WHITE }),
	],
	[
		clockKey("classic", BRAND.blue, { time: WHITE }),
		clockKey("modern", BRAND.red, { time: BRAND.amber }),
		clockKey("line", WHITE, { time: BRAND.red }),
		clockKey("comet", "#BF5AF2", { time: YELLOW }),
		clockKey("big", BRAND.red, { time: WHITE }),
	],
	[
		clockKey("classic", BRAND.red, {
			time: "#111111",
			inactive: "#C8C8C8",
			background: WHITE,
		}),
		clockKey("modern", WHITE, {
			time: YELLOW,
			inactive: "#5560B0",
			background: "#1B1464",
		}),
		clockKey("line", WHITE, {
			time: YELLOW,
			inactive: "#E0606F",
			background: "#B00020",
		}),
		clockKey("comet", BRAND.mint, { time: "#C7C7CC" }),
		clockKey("big", "#111111", {
			time: "#111111",
			inactive: "#B37300",
			background: BRAND.amber,
		}),
	],
];

function colorsSequence(stepMs: number): Sequence {
	const startMs = ASSET_TIME_MS;
	const first = COMBOS[0] ?? [];
	const events: Array<[number, (sim: DeviceSim, nowMs: number) => void]> = [];
	COMBOS.forEach((combo, step) => {
		if (step === 0) return;
		events.push([
			step * stepMs,
			(sim, now) => {
				combo.forEach((k, i) => {
					sim.setClock(`k${i}`, k, now);
				});
			},
		]);
	});
	return {
		startMs,
		durationMs: COMBOS.length * stepMs,
		ids: ids(first.length),
		sim: clockSim(first, startMs),
		events,
	};
}

const README_KEYS: readonly ClockKey[] = [
	clockKey("classic", BRAND.red),
	clockKey("line", CYAN, { time: WHITE }),
	clockKey("comet", BRAND.pink, { time: CYAN }),
	clockKey("big", BRAND.mint, { time: WHITE }),
];

/** The README demo: four faces from 10:08:58 across the minute change. */
function readmeSequence(): Sequence {
	const startMs = BEFORE_MINUTE_MS + 2000;
	return {
		startMs,
		durationMs: 4000,
		ids: ids(README_KEYS.length),
		sim: clockSim(README_KEYS, startMs),
	};
}

const GIF_STRIP: StripLayout = { key: 160, gap: 24, pad: 36 };

// ---------- Marketplace video ----------

const V_W = 1920;
const V_H = 1080;
const V_FPS = 30;
/** Between scenes the picture dips to the empty stage and back (half each way). */
const V_FADE_MS = 400;

interface Scene {
	durationMs: number;
	/** The full 1920x1080 SVG at `atMs` after the scene start. */
	frameAt: (atMs: number) => string;
}

function rowScene(
	layout: Omit<RowLayout, "keys">,
	seq: Sequence,
	durationMs = seq.durationMs,
): Scene {
	const done = new Set<number>();
	return {
		durationMs,
		frameAt: (atMs) =>
			rowPage({ ...layout, keys: [] }, sequenceAt(seq, atMs, done), V_H),
	};
}

const WORLD_KEYS: readonly ClockKey[] = [
	clockKey("classic", CYAN, {
		time: WHITE,
		label: "BER",
		zone: "Europe/Berlin",
	}),
	clockKey("line", BRAND.amber, {
		time: WHITE,
		label: "NYC",
		zone: "America/New_York",
	}),
	clockKey("modern", BRAND.mint, {
		time: YELLOW,
		label: "TYO",
		zone: "Asia/Tokyo",
	}),
	clockKey("line", BRAND.pink, {
		time: WHITE,
		label: "LDN",
		zone: "Europe/London",
	}),
	clockKey("classic", PURPLE, {
		time: WHITE,
		label: "SYD",
		zone: "Australia/Sydney",
	}),
];

function videoScenes(): Scene[] {
	const faces = facesSequence(6000);
	const countdown = countdownSequence(6, 2500);
	const world: Sequence = {
		startMs: ASSET_TIME_MS,
		durationMs: 4500,
		ids: ids(WORLD_KEYS.length),
		sim: clockSim(WORLD_KEYS, ASSET_TIME_MS),
	};
	const colors = colorsSequence(2000);
	const endMs = 3500;
	const endLayout: HeroLayout = {
		w: V_W,
		h: V_H,
		margin: 120,
		cols: 4,
		rows: 3,
		key: 240,
		gap: 32,
		nameSize: 160,
		claimSize: 50,
		keys: HERO_KEYS,
	};
	return [
		rowScene(
			{
				heading: "Five watchfaces",
				support: "Smooth rings, rolling digits, in any color.",
				captions: FACE_NAMES,
				key: 304,
			},
			faces,
		),
		rowScene(
			{
				heading: "Countdown with overtime",
				support: "One press to start. A pulse warns, overtime counts up.",
				captions: ["Countdown key", "Classic", "Line", "Big"],
				key: 330,
			},
			countdown,
		),
		rowScene(
			{
				heading: "World clocks",
				support: "Any time zone, with a short label.",
				captions: ["Berlin", "New York", "Tokyo", "London", "Sydney"],
				key: 304,
			},
			world,
		),
		rowScene(
			{
				heading: COLORS_ROW.heading,
				support: COLORS_ROW.support,
				captions: [],
				key: 304,
			},
			colors,
		),
		{
			durationMs: endMs,
			// Device-like 100 ms steps; the hero's countdown key runs on.
			frameAt: (atMs) =>
				hero(endLayout, STILL_MS + Math.floor(atMs / FRAME_MS) * FRAME_MS),
		},
	];
}

/** Mixes `b` over `a` by `k` (0..1) into a new frame. */
function blend(a: Uint8Array, b: Uint8Array, k: number): Uint8Array {
	const out = new Uint8Array(b.length);
	for (let i = 0; i < b.length; i++)
		out[i] = Math.round((a[i] ?? 0) * (1 - k) + (b[i] ?? 0) * k);
	return out;
}

/** Calls `onFrame` with every 1920x1080 RGBA frame of the video, in order. */
async function videoFrames(
	onFrame: (rgba: Uint8Array) => Promise<void>,
): Promise<number> {
	const stage = resvg(page(V_W, V_H, "")).render().pixels;
	let index = 0;
	let last: Uint8Array | undefined;
	for (const scene of videoScenes()) {
		const count = Math.round((scene.durationMs * V_FPS) / 1000);
		let cachedSvg = "";
		let cached: Uint8Array | undefined;
		for (let i = 0; i < count; i++) {
			const atMs = (i * 1000) / V_FPS;
			const svg = scene.frameAt(atMs);
			if (svg !== cachedSvg || !cached) {
				cached = resvg(svg).render().pixels;
				cachedSvg = svg;
			}
			const k = last && atMs < V_FADE_MS ? atMs / V_FADE_MS : 1;
			let frame = cached;
			if (last && k < 0.5) frame = blend(last, stage, k * 2);
			else if (k < 1) frame = blend(stage, cached, (k - 0.5) * 2);
			await onFrame(frame);
			index++;
			if (i === count - 1) last = cached;
		}
	}
	return index;
}

/**
 * Encodes the Marketplace gallery video (1920x1080, H.264, 30 fps, no audio) with
 * ffmpeg (FFMPEG or the one on PATH); raw RGBA frames go through a pipe.
 */
export async function buildVideo(
	outFile: string,
): Promise<{ frames: number; seconds: number }> {
	mkdirSync(dirname(outFile), { recursive: true });
	const ffmpeg = spawn(
		process.env.FFMPEG ?? "ffmpeg",
		[
			"-y",
			"-loglevel",
			"error",
			"-f",
			"rawvideo",
			"-pix_fmt",
			"rgba",
			"-s",
			`${V_W}x${V_H}`,
			"-r",
			String(V_FPS),
			"-i",
			"-",
			"-c:v",
			"libx264",
			"-preset",
			"slow",
			"-crf",
			"18",
			"-pix_fmt",
			"yuv420p",
			"-movflags",
			"+faststart",
			"-an",
			outFile,
		],
		{ stdio: ["pipe", "inherit", "inherit"] },
	);
	const exited = new Promise<number>((resolve, reject) => {
		ffmpeg.on("error", reject);
		ffmpeg.on("close", (code) => resolve(code ?? 1));
	});
	const stdin = ffmpeg.stdin;
	const frames = await videoFrames(async (rgba) => {
		if (!stdin.write(rgba))
			await new Promise<void>((resolve) => stdin.once("drain", resolve));
	});
	stdin.end();
	const code = await exited;
	if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
	return { frames, seconds: frames / V_FPS };
}

// ---------- app icon ----------

/**
 * The plugin's own 60-dot seconds ring at `second` (dots up to it lit), straight from
 * the renderer but without digits: the part of the clock that still reads at 32 px.
 */
function secondsRing(second: number, active: string, inactive: string): string {
	const cfg = clockConfig(clockKey("classic", active, { inactive }));
	const minute = ASSET_TIME_MS - 30_000;
	const m = buildFaceModel(minute + second * 1000 + 400, cfg);
	return dotRing(m, cfg.colors, STATIC_ANIM);
}

/** "ON" over "AIR" in the condensed broadcast capitals, centred in the 144 box. */
function onAirStack(fill: string): string {
	const word: TextOptions = {
		family: COND,
		weight: 800,
		size: 46,
		fill,
		anchor: "middle",
		tracking: 0.02,
	};
	const cap = word.size * TEXT_CAP;
	const gap = word.size * 0.14;
	const top = 72 - (2 * cap + gap) / 2;
	return (
		text("ON", 72, top + cap, word) + text("AIR", 72, top + 2 * cap + gap, word)
	);
}

/** A: the product as its logo, a black key with the Classic face on ultramarine. */
function iconKey(): string {
	keyCounter = 0;
	const face = keySvg(
		clockKey("classic", BRAND.red, {
			time: WHITE,
			showDate: false,
			showSeconds: false,
		}),
	);
	const size = 118;
	const pad = (144 - size) / 2;
	return page(144, 144, keyAt(pad, pad - 2, size, face), shadowFilter(size));
}

/** B: studio black, the red seconds ring around "ON AIR". */
function iconRing(): string {
	return page(
		144,
		144,
		secondsRing(44, BRAND.red, "#4A4A4A") + onAirStack(WHITE),
		"",
		BRAND.black,
	);
}

/** C: brand ultramarine, a white seconds ring around "ON AIR". */
function iconBrand(): string {
	return page(144, 144, secondsRing(44, WHITE, "#7C86FF") + onAirStack(WHITE));
}

export const ICON_VARIANTS = { a: iconKey, b: iconRing, c: iconBrand } as const;
/** The variant used for the Marketplace app icon and the plugin icon. */
export const ICON_CHOICE: keyof typeof ICON_VARIANTS = "b";

/** Every icon variant at 288, 64 and 32 px, on the dark and the light ground. */
function iconSizesSheet(): string {
	const sizes = [288, 64, 32];
	const pad = 32;
	const rowH = 288 + pad;
	const colW = 288 + 64 + 32 + 4 * pad;
	const variants = Object.values(ICON_VARIANTS);
	const grounds = ["#1E1E24", "#F2F2EE"];
	let body = "";
	grounds.forEach((ground, gi) => {
		const y0 = pad + gi * rowH;
		body += `<rect x="0" y="${y0 - pad / 2}" width="${variants.length * colW + pad}" height="${rowH}" fill="${ground}"/>`;
		variants.forEach((variant, vi) => {
			let x = pad + vi * colW;
			for (const s of sizes) {
				const inner = variant().replace(
					/^<svg[^>]*>/,
					`<svg x="${x}" y="${y0 + (288 - s) / 2}" width="${s}" height="${s}" viewBox="0 0 144 144">`,
				);
				body += scopeIds(inner, `i${gi}${vi}${s}`);
				x += s + pad;
			}
		});
	});
	const w = variants.length * colW + pad;
	const h = grounds.length * rowH + pad;
	return page(w, h, body, "", "#1E1E24");
}

// ---------- build ----------

function brandSvg(name: string): string {
	return readFileSync(join(BRAND_DIR, name), "utf8");
}

/** Generates every asset under `outRoot` (the repo root for `npm run assets`). */
export async function buildAssets(outRoot: string): Promise<string[]> {
	const written: string[] = [];
	const write = (rel: string, data: Buffer | string) => {
		const file = join(outRoot, rel);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, data);
		written.push(rel);
	};
	const imgs = `${PLUGIN}/imgs`;

	// Plugin and Marketplace icon, with every variant for the maintainer's choice.
	const icon = ICON_VARIANTS[ICON_CHOICE]();
	write(`${imgs}/plugin/icon.png`, png(icon, 256));
	write(`${imgs}/plugin/icon@2x.png`, png(icon, 512));
	write("marketing/marketplace-icon.png", png(icon, 288));
	for (const [name, variant] of Object.entries(ICON_VARIANTS))
		write(`marketing/icon-variants/icon-${name}.png`, png(variant(), 288));
	write("marketing/icon-variants/sizes.png", png(iconSizesSheet()));

	// Monochrome white icons for the Stream Deck app.
	write(`${imgs}/plugin/category.svg`, brandSvg("category.svg"));
	write(`${imgs}/actions/clock/icon.svg`, brandSvg("action-clock.svg"));
	write(`${imgs}/actions/countdown/icon.svg`, brandSvg("action-countdown.svg"));

	// Default key images: the plugin's default clock and the idle countdown key.
	const clockDefault = keySvg(
		clockKey(CLOCK_DEFAULTS.face, CLOCK_DEFAULTS.colors.active),
	);
	write(`${imgs}/actions/clock/key.png`, png(clockDefault, 72));
	write(`${imgs}/actions/clock/key@2x.png`, png(clockDefault, 144));
	const countdownIdle = renderCountdownKey(
		null,
		COUNTDOWN_DEFAULTS.durationSec,
		COUNTDOWN_DEFAULTS.color,
	);
	write(`${imgs}/actions/countdown/key.png`, png(countdownIdle, 72));
	write(`${imgs}/actions/countdown/key@2x.png`, png(countdownIdle, 144));

	// Encoder (dial) icon: the default clock on a round black dial.
	const encoder = keySvg(
		clockKey("line", CLOCK_DEFAULTS.colors.active, { showSeconds: false }),
	).replace(
		/<rect width="144" height="144" fill="#000000"\/>/,
		`<circle cx="72" cy="72" r="72" fill="${BRAND.black}"/>`,
	);
	write(`${imgs}/actions/clock/encoder.png`, png(encoder, 72));
	write(`${imgs}/actions/clock/encoder@2x.png`, png(encoder, 144));

	// Marketplace gallery (1920x960) and social preview (1280x640).
	write("marketing/gallery-1-hero.png", png(hero(GALLERY_HERO)));
	// All hero directions for the maintainer's choice (HERO_CHOICE picks the one above).
	for (const [name, variant] of Object.entries(HERO_VARIANTS))
		write(
			`marketing/hero-variants/hero-${name}.png`,
			png(variant(GALLERY_HERO)),
		);
	write("marketing/gallery-2-faces.png", png(row(FACES_ROW)));
	write("marketing/gallery-3-timezones.png", png(row(ZONES_ROW)));
	write("marketing/gallery-4-countdown.png", png(row(COUNTDOWN_ROW)));
	write("marketing/gallery-5-colors.png", png(row(COLORS_ROW)));
	const social: HeroLayout = {
		w: 1280,
		h: 640,
		margin: 80,
		cols: 3,
		rows: 2,
		key: 200,
		gap: 28,
		nameSize: 100,
		claimSize: 32,
		keys: SOCIAL_KEYS,
	};
	write("marketing/social-preview.png", png(hero(social)));

	// README.
	write(
		"docs/images/readme-hero.png",
		png(
			hero({
				w: 1600,
				h: 640,
				margin: 96,
				cols: 4,
				rows: 2,
				key: 200,
				gap: 28,
				nameSize: 104,
				claimSize: 34,
				keys: HERO_KEYS,
			}),
		),
	);
	write(
		"docs/images/readme-demo.gif",
		sequenceGif(readmeSequence(), { key: 184, gap: 32, pad: 40 }),
	);
	write(
		"docs/images/gif-faces.gif",
		sequenceGif(facesSequence(7000), { ...GIF_STRIP, captions: FACE_NAMES }),
	);
	write(
		"docs/images/gif-countdown.gif",
		sequenceGif(countdownSequence(12, 2600), {
			key: 170,
			gap: 28,
			pad: 36,
			captions: ["Countdown key", "Classic", "Line", "Big"],
		}),
	);
	write(
		"docs/images/gif-colors.gif",
		sequenceGif(colorsSequence(1500), GIF_STRIP),
	);
	return written;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	if (process.argv.includes("--video")) {
		const out = join(ROOT, "marketing/store-video.mp4");
		const { frames, seconds } = await buildVideo(out);
		console.log(
			`wrote marketing/store-video.mp4 (${frames} frames, ${seconds} s)`,
		);
	} else {
		const files = await buildAssets(ROOT);
		for (const f of files) console.log(`wrote ${f}`);
	}
}
