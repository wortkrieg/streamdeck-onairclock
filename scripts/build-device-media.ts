// Marketplace images with a real Stream Deck: Elgato's MK.2 product photo from its press
// kit, with this plugin's keys set into the 15 displays through the photo's perspective.
// The photo is downloaded once into .cache/ (Elgato's asset, not in git). Needs ffmpeg
// (PATH or FFMPEG).
//
//   npm run assets:device
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { ADJUST_DEFAULTS, COUNTDOWN_DEFAULTS } from "../src/core/settings";
import { renderAdjustKey } from "../src/render/adjust-key";
import { renderCountdownKey } from "../src/render/countdown-key";
import {
	BRAND,
	COLORS_ROW,
	COND,
	FACES_ROW,
	G_H,
	G_MARGIN,
	G_W,
	keySvg,
	PAPER_SOFT,
	page,
	pairSwatches,
	png,
	ROOT,
	scopeIds,
	TEXT,
	TEXT_CAP,
	type TextOptions,
	text,
	ZONES_ROW,
} from "./build-assets";

/** Stream Deck MK.2, front, no cable, with shadow (Elgato press kit on keystone.corsair.com). */
const PHOTO_URL =
	"https://res.cloudinary.com/corsairdam/image/upload/v1774609007/Stream_Deck_MK.2_Device_Shot_02_No_Cable_Shadow_u0zfei.png";
const PHOTO = join(ROOT, ".cache/elgato/mk2-front.png");
const PHOTO_W = 6000;
const PHOTO_H = 4000;

type Pt = readonly [number, number];

/**
 * Outer display corners in the photo (px), measured at full size: top left of the first
 * key, top right of the fifth, bottom left of the eleventh, bottom right of the last.
 */
const DISPLAY_CORNERS: readonly Pt[] = [
	[1438, 1255],
	[4700, 1255],
	[1368, 2777],
	[4760, 2777],
];
/** The key grid seen from the front, in flat units: display size and key pitch. */
const LCD = 500;
const PITCH = 692;
const GRID_W = 4 * PITCH + LCD;
const GRID_H = 2 * PITCH + LCD;
/** Black around each display, so no edge of the photo's own key icons shows. */
const BLEED = 14;
/** Transparent margin around the flat grid, so ffmpeg's edge clamping stays invisible. */
const PAD = 160;
/** The device with its shadow, cropped out of the photo. */
const CROP = { x: 800, y: 700, w: 4560, h: 2920 } as const;

/** The 15 keys, row by row: the five faces, five world clocks, two colors and the countdown keys. */
function deviceKeys(): string[] {
	const adjust = (direction: "plus" | "minus") =>
		renderAdjustKey(direction, ADJUST_DEFAULTS.stepSec, ADJUST_DEFAULTS.color);
	return [
		...FACES_ROW.keys.map((k) => keySvg(k)),
		...ZONES_ROW.keys.map((k) => keySvg(k)),
		...COLORS_ROW.keys
			.filter((_, i) => i === 0 || i === 2)
			.map((k) => keySvg(k)),
		renderCountdownKey(
			null,
			COUNTDOWN_DEFAULTS.durationSec,
			COUNTDOWN_DEFAULTS.color,
		),
		adjust("plus"),
		adjust("minus"),
	];
}

/** The keys on a flat grid, stretched to the photo's size for ffmpeg's perspective filter. */
function flatGrid(keys: readonly string[]): string {
	const r = LCD * 0.07;
	const body = keys
		.map((svg, i) => {
			const x = (i % 5) * PITCH;
			const y = Math.floor(i / 5) * PITCH;
			const id = `d${i}`;
			const inner = scopeIds(svg, id).replace(
				/^<svg[^>]*>/,
				`<svg x="${x}" y="${y}" width="${LCD}" height="${LCD}" viewBox="0 0 144 144">`,
			);
			return `<clipPath id="${id}-lcd"><rect x="${x}" y="${y}" width="${LCD}" height="${LCD}" rx="${r}"/></clipPath><rect x="${x - BLEED}" y="${y - BLEED}" width="${LCD + 2 * BLEED}" height="${LCD + 2 * BLEED}" rx="${r + BLEED}" fill="${BRAND.black}"/><g clip-path="url(#${id}-lcd)">${inner}</g>`;
		})
		.join("");
	const vb = `${-PAD} ${-PAD} ${GRID_W + 2 * PAD} ${GRID_H + 2 * PAD}`;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO_W}" height="${PHOTO_H}" viewBox="${vb}" preserveAspectRatio="none">${body}</svg>`;
}

export type Homography = readonly [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
];

/** The projective map sending four points to four points (h33 = 1). */
export function homography(src: readonly Pt[], dst: readonly Pt[]): Homography {
	// The 8 x 9 augmented system, row-major.
	const a: number[] = [];
	src.forEach(([x, y], i) => {
		const [u, v] = dst[i] ?? [0, 0];
		a.push(x, y, 1, 0, 0, 0, -u * x, -u * y, u);
		a.push(0, 0, 0, x, y, 1, -v * x, -v * y, v);
	});
	const at = (r: number, c: number): number => a[r * 9 + c] ?? 0;
	// Gauss-Jordan elimination with partial pivoting.
	for (let c = 0; c < 8; c++) {
		let p = c;
		for (let r = c + 1; r < 8; r++)
			if (Math.abs(at(r, c)) > Math.abs(at(p, c))) p = r;
		for (let k = 0; k < 9; k++) {
			const t = at(c, k);
			a[c * 9 + k] = at(p, k);
			a[p * 9 + k] = t;
		}
		for (let r = 0; r < 8; r++) {
			if (r === c) continue;
			const f = at(r, c) / at(c, c);
			for (let k = c; k < 9; k++) a[r * 9 + k] = at(r, k) - f * at(c, k);
		}
	}
	const h = (i: number): number => at(i, 8) / at(i, i);
	return [h(0), h(1), h(2), h(3), h(4), h(5), h(6), h(7), 1];
}

export function project(h: Homography, [x, y]: Pt): Pt {
	const [a, b, c, d, e, f, g, k, l] = h;
	const w = g * x + k * y + l;
	return [(a * x + b * y + c) / w, (d * x + e * y + f) / w];
}

async function ensurePhoto(): Promise<void> {
	if (existsSync(PHOTO)) return;
	const res = await fetch(PHOTO_URL);
	if (!res.ok) throw new Error(`download failed: ${res.status} ${PHOTO_URL}`);
	mkdirSync(dirname(PHOTO), { recursive: true });
	writeFileSync(PHOTO, Buffer.from(await res.arrayBuffer()));
}

function ffmpeg(args: string[]): void {
	execFileSync(process.env.FFMPEG ?? "ffmpeg", [
		"-loglevel",
		"error",
		"-y",
		...args,
	]);
}

/** The photo with the plugin's keys in its displays, cropped to the device; `width` px wide. */
function deviceImage(dir: string, width: number): Buffer {
	const flat = join(dir, "flat.png");
	writeFileSync(flat, png(flatGrid(deviceKeys())));
	const h = homography(
		[
			[0, 0],
			[GRID_W, 0],
			[0, GRID_H],
			[GRID_W, GRID_H],
		],
		DISPLAY_CORNERS,
	);
	const corners = (
		[
			[-PAD, -PAD],
			[GRID_W + PAD, -PAD],
			[-PAD, GRID_H + PAD],
			[GRID_W + PAD, GRID_H + PAD],
		] as const
	).map((p) => project(h, p));
	const persp = corners
		.map(([x, y], i) => `x${i}=${x.toFixed(2)}:y${i}=${y.toFixed(2)}`)
		.join(":");
	const out = join(dir, `device-${width}.png`);
	ffmpeg([
		"-i",
		PHOTO,
		"-i",
		flat,
		"-filter_complex",
		`[1]format=rgba,perspective=${persp}:sense=destination:interpolation=cubic[keys];[0][keys]overlay=format=auto,format=rgba,crop=${CROP.w}:${CROP.h}:${CROP.x}:${CROP.y},scale=${width}:-1:flags=lanczos`,
		"-frames:v",
		"1",
		out,
	]);
	return readFileSync(out);
}

/** Thumbnail and first gallery image: name and claim left, the Stream Deck right. */
function deviceHero(device: Buffer, deviceW: number): string {
	const devH = (deviceW * CROP.h) / CROP.w;
	const x = G_W - G_MARGIN / 2 - deviceW;
	const y = (G_H - devH) / 2 + 10;
	const word: TextOptions = {
		family: COND,
		weight: 800,
		size: 150,
		fill: BRAND.paper,
		tracking: 0.06,
	};
	const cap = word.size * TEXT_CAP;
	const top = 300;
	const left = G_MARGIN - word.size * 0.01;
	let body = text("ON AIR", left, top, word);
	body += text("CLOCK", left, top + cap + word.size * 0.2, word);
	const claim: TextOptions = {
		family: TEXT,
		weight: 500,
		size: 46,
		fill: PAPER_SOFT,
	};
	const c1 = top + cap + word.size * 0.62 + claim.size * TEXT_CAP;
	body += text("Studio clocks in any color,", G_MARGIN, c1, claim);
	body += text("on any key.", G_MARGIN, c1 + claim.size * 1.3, claim);
	body += pairSwatches(G_MARGIN, c1 + claim.size * 1.3 + 90, 30);
	body += `<image x="${x}" y="${y.toFixed(1)}" width="${deviceW}" height="${devH.toFixed(1)}" href="data:image/png;base64,${device.toString("base64")}"/>`;
	return page(G_W, G_H, body);
}

export async function buildDeviceMedia(outRoot: string): Promise<string[]> {
	await ensurePhoto();
	const dir = mkdtempSync(join(tmpdir(), "onair-device-"));
	try {
		const deviceW = 1150;
		// Embedded at twice its size, so the @2x rendering stays sharp.
		const svg = deviceHero(deviceImage(dir, deviceW * 2), deviceW);
		const written: string[] = [];
		for (const [rel, zoom] of [
			["marketing/gallery-device.png", 1],
			["marketing/gallery-device@2x.png", 2],
		] as const) {
			writeFileSync(join(outRoot, rel), png(svg, undefined, zoom));
			written.push(rel);
		}
		return written;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
	for (const f of await buildDeviceMedia(ROOT)) console.log(`wrote ${f}`);
