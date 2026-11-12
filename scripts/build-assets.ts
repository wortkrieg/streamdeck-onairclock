// Builds every icon, key image and marketing image ("Farbraum" branding) from the SVG
// sources in assets/brand and the plugin's own face renderer. Deterministic: a fixed
// time, explicit time zones and only the bundled fonts in assets/fonts.
//
//   npm run assets
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { buildFaceModel } from "../src/core/clock-model";
import { type Countdown, viewCountdown } from "../src/core/countdown";
import {
	CLOCK_DEFAULTS,
	type ClockConfig,
	COUNTDOWN_DEFAULTS,
	type FaceId,
} from "../src/core/settings";
import { animState } from "../src/render/animation";
import { renderCountdownKey } from "../src/render/countdown-key";
import { renderFace } from "../src/render/faces/index";

// gifenc's ESM build only default-exports GIFEncoder; its CJS build has everything, the
// same under tsx and vitest.
const gifenc = createRequire(import.meta.url)(
	"gifenc",
) as typeof import("gifenc");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_DIR = join(ROOT, "assets/brand");
/**
 * Only these fonts are loaded (no system fonts), so the output is the same everywhere.
 * Barlow: google/fonts ofl/barlow. Unbounded-Bold: static instance from googlefonts/unbounded
 * (commit f3ec432, the upstream of google/fonts ofl/unbounded) because resvg does not apply
 * the weight axis of the variable font. Both OFL 1.1, licences next to the files.
 */
const FONT_FILES = [
	"Unbounded-Bold.ttf",
	"Barlow-Regular.ttf",
	"Barlow-Medium.ttf",
	"Barlow-SemiBold.ttf",
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
const HEAD = "Unbounded";
const TEXT = "Barlow";
/** Cap heights in em, measured from the bundled fonts. */
const HEAD_CAP = 0.75;
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
		colors: { ...CLOCK_DEFAULTS.colors, active: k.color, time: k.color },
	};
}

/** The 144x144 key SVG exactly as the plugin would draw it at `nowMs`. */
function keySvg(k: KeySpec, nowMs = STILL_MS): string {
	if (k.kind === "countdown") {
		const durationSec = k.durationSec ?? COUNTDOWN_DEFAULTS.durationSec;
		const c: Countdown = {
			deviceId: "assets",
			sourceActionId: "assets",
			startMs: nowMs - k.elapsedMs,
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

/** The six clock colours in a fixed order. */
const COLORS = [
	BRAND.red,
	BRAND.white,
	BRAND.amber,
	BRAND.mint,
	BRAND.blue,
	BRAND.pink,
] as const;

/** Hero grid, row by row: every face, every colour twice, a world clock and a countdown. */
const HERO_KEYS: readonly KeySpec[] = [
	clockKey("classic", BRAND.red),
	clockKey("big", BRAND.white),
	clockKey("comet", BRAND.amber),
	clockKey("line", BRAND.mint),
	clockKey("line", BRAND.blue, { label: "NYC", zone: "America/New_York" }),
	clockKey("modern", BRAND.pink),
	countdownKey(BRAND.red, 195_400),
	clockKey("classic", BRAND.white, { label: "TYO", zone: "Asia/Tokyo" }),
	clockKey("big", BRAND.amber),
	clockKey("comet", BRAND.mint),
	clockKey("modern", BRAND.blue),
	clockKey("line", BRAND.pink),
];

/** 3x2 for the social preview: every colour once, a world clock among them. */
const SOCIAL_KEYS: readonly KeySpec[] = [
	clockKey("classic", BRAND.red),
	clockKey("big", BRAND.white),
	clockKey("comet", BRAND.amber),
	clockKey("line", BRAND.blue, { label: "NYC", zone: "America/New_York" }),
	clockKey("modern", BRAND.pink),
	clockKey("line", BRAND.mint),
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

/** Name and claim on the left, a grid of keys on the right; swatches close the column. */
function hero(l: HeroLayout): string {
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
			keySvg(k),
		);
	});

	// Name: cap top on the grid's top edge; optical left edge on the margin.
	const name: TextOptions = {
		family: HEAD,
		weight: 700,
		size: l.nameSize,
		fill: BRAND.paper,
		tracking: -0.02,
	};
	const tx = l.margin - l.nameSize * 0.037;
	const line1 = y0 + l.nameSize * HEAD_CAP;
	const line2 = line1 + l.nameSize * 1.04;
	body += text("On Air", tx, line1, name);
	body += text("Clock", tx, line2, name);

	const claim: TextOptions = {
		family: TEXT,
		weight: 500,
		size: l.claimSize,
		fill: PAPER_SOFT,
	};
	const cx = l.margin - l.claimSize * 0.047;
	const c1 = line2 + l.nameSize * 0.36 + l.claimSize * TEXT_CAP;
	body += text("Studio clocks in any color,", cx, c1, claim);
	body += text("on any key.", cx, c1 + l.claimSize * 1.3, claim);

	// Six colour swatches, bottom edge on the grid's bottom edge.
	const d = l.claimSize * 0.62;
	const step = d * 1.6;
	COLORS.forEach((color, i) => {
		body += `<circle cx="${n2(l.margin + d / 2 + i * step)}" cy="${n2(y0 + gh - d / 2)}" r="${n2(d / 2)}" fill="${color}"/>`;
	});
	return page(l.w, l.h, body, shadowFilter(l.key));
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

/**
 * Heading and supporting line top left on the margin, one row of keys spanning the
 * width with captions below; equal space above and below the row.
 */
function row(l: RowLayout): string {
	keyCounter = 0;
	const headBase = G_MARGIN + G_HEAD * HEAD_CAP;
	const supportBase = headBase + 72;
	let body = text(l.heading, G_MARGIN - G_HEAD * 0.037, headBase, {
		family: HEAD,
		weight: 700,
		size: G_HEAD,
		fill: BRAND.paper,
		tracking: -0.01,
	});
	body += text(l.support, G_MARGIN - G_SUPPORT * 0.047, supportBase, {
		family: TEXT,
		weight: 500,
		size: G_SUPPORT,
		fill: PAPER_SOFT,
	});

	const count = l.keys.length;
	const span = G_W - 2 * G_MARGIN;
	const gap = count > 1 ? (span - count * l.key) / (count - 1) : 0;
	const captionGap = 44;
	const blockH = l.key + captionGap + G_CAPTION * (TEXT_CAP + TEXT_DESC);
	const top = supportBase + G_SUPPORT * TEXT_DESC;
	const y = (top + G_H - blockH) / 2;
	l.keys.forEach((k, i) => {
		const x = G_MARGIN + i * (l.key + gap);
		body += keyAt(x, y, l.key, keySvg(k));
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
	return page(G_W, G_H, body, shadowFilter(l.key));
}

const FACES_ROW: RowLayout = {
	heading: "Five watchfaces",
	support: "Pick one per key, in any color.",
	keys: [
		clockKey("classic", BRAND.red),
		clockKey("modern", BRAND.white),
		clockKey("line", BRAND.mint),
		clockKey("comet", BRAND.amber),
		clockKey("big", BRAND.blue),
	],
	captions: ["Classic", "Modern Minimal", "Line", "Comet", "Big"],
	key: 304,
};

const ZONES_ROW: RowLayout = {
	heading: "World clocks with time zones",
	support: "Any IANA zone or a fixed UTC offset.",
	keys: [
		clockKey("line", BRAND.red, { label: "BER", zone: "Europe/Berlin" }),
		clockKey("line", BRAND.amber, { label: "NYC", zone: "America/New_York" }),
		clockKey("line", BRAND.mint, { label: "TYO", zone: "Asia/Tokyo" }),
		clockKey("line", BRAND.blue, { label: "LON", zone: "Europe/London" }),
		clockKey("line", BRAND.pink, { label: "SYD", zone: "Australia/Sydney" }),
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

// ---------- README demo GIF ----------

const GIF_KEYS: readonly ClockKey[] = [
	clockKey("classic", BRAND.red),
	clockKey("line", BRAND.mint),
	clockKey("comet", BRAND.amber),
	clockKey("big", BRAND.blue),
];
const GIF_FPS = 12;
export const GIF_FRAMES = 3 * GIF_FPS;
/**
 * 1.6 s before the minute change from 10:08 to 10:09; 400 ms into the second so the
 * first frame (the poster where GIFs do not play) has its colon on.
 */
const GIF_START_MS = ASSET_TIME_MS + 28_400;
const GIF_KEY = 184;
const GIF_GAP = 32;
const GIF_PAD = 40;

/** Frame `i` of the README GIF as an SVG document. */
export function demoFrameSvg(i: number): string {
	const t = GIF_START_MS + Math.round((i * 1000) / GIF_FPS);
	const n = GIF_KEYS.length;
	const w = 2 * GIF_PAD + n * GIF_KEY + (n - 1) * GIF_GAP;
	const h = 2 * GIF_PAD + GIF_KEY;
	keyCounter = 0;
	let body = "";
	GIF_KEYS.forEach((k, j) => {
		const x = GIF_PAD + j * (GIF_KEY + GIF_GAP);
		body += keyAt(x, GIF_PAD, GIF_KEY, keySvg(k, t), false);
	});
	return page(w, h, body);
}

function demoGif(): Buffer {
	let w = 0;
	let h = 0;
	const frames: Uint8Array[] = [];
	for (let i = 0; i < GIF_FRAMES; i++) {
		const img = resvg(demoFrameSvg(i)).render();
		w = img.width;
		h = img.height;
		frames.push(img.pixels);
	}
	// One palette for all frames, so colours do not flicker between frames.
	const frameBytes = w * h * 4;
	const sample = new Uint8Array(frames.length * frameBytes);
	for (const [i, f] of frames.entries()) sample.set(f, i * frameBytes);
	const palette = gifenc.quantize(sample, 256);
	const gif = gifenc.GIFEncoder();
	frames.forEach((f, i) => {
		const index = gifenc.applyPalette(f, palette);
		gif.writeFrame(index, w, h, {
			palette: i === 0 ? palette : undefined,
			delay: Math.round(1000 / GIF_FPS),
		});
	});
	gif.finish();
	return Buffer.from(gif.bytes());
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

	// Plugin and Marketplace icon.
	const icon = brandSvg("plugin-icon.svg");
	write(`${imgs}/plugin/icon.png`, png(icon, 256));
	write(`${imgs}/plugin/icon@2x.png`, png(icon, 512));
	write("marketing/marketplace-icon.png", png(icon, 288));

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
	write(
		"marketing/gallery-1-hero.png",
		png(
			hero({
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
			}),
		),
	);
	write("marketing/gallery-2-faces.png", png(row(FACES_ROW)));
	write("marketing/gallery-3-timezones.png", png(row(ZONES_ROW)));
	write("marketing/gallery-4-countdown.png", png(row(COUNTDOWN_ROW)));
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
	write("docs/images/readme-demo.gif", demoGif());
	return written;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const files = await buildAssets(ROOT);
	for (const f of files) console.log(`wrote ${f}`);
}
