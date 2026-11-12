// Light-stage media for marc.fail (blog post and product page), rendered with the
// plugin's own renderer: stills (+ @2x), short source videos (+ @2x) and 288/576 px face
// renders. Output: marketing/marc-fail/ (untracked handover folder); the videos are also
// copied to marketing/videos/ (tracked). Needs ffmpeg (PATH or FFMPEG).
//
//   npm run assets:light [-- <outDir>]
import { execFileSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { buildFaceModel } from "../src/core/clock-model";
import { type Countdown, viewCountdown } from "../src/core/countdown";
import {
	CLOCK_DEFAULTS,
	type ClockConfig,
	type FaceId,
} from "../src/core/settings";
import { animState } from "../src/render/animation";
import { renderCountdownKey } from "../src/render/countdown-key";
import { renderFace } from "../src/render/faces/index";

// Deterministic wall times (the stills and videos show Berlin time).
process.env.TZ = "Europe/Berlin";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONTS = [
	"Barlow-Regular.ttf",
	"Barlow-Medium.ttf",
	"Barlow-SemiBold.ttf",
].map((f) => join(ROOT, "assets/fonts", f));
const OUT = process.argv[2] ?? join(ROOT, "marketing/marc-fail");
const MEDIA = join(OUT, "media");
const VIDEOS = join(ROOT, "marketing/videos");
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FRAMES = mkdtempSync(join(tmpdir(), "onair-light-"));
mkdirSync(MEDIA, { recursive: true });
mkdirSync(VIDEOS, { recursive: true });

const STAGE_TOP = "#EEEEEA";
const STAGE_BOTTOM = "#E9E9E5";
const at = (h: number, m: number, s: number, ms = 0) =>
	new Date(2026, 10, 11, h, m, s, ms).getTime();
const FACES: FaceId[] = ["classic", "modern", "line", "comet", "big"];

type Clock = { kind: "clock"; cfg: ClockConfig };
type Cd = { kind: "countdown"; durationSec: number; color: string };
type Key = Clock | Cd;
const clock = (face: FaceId, over: Partial<ClockConfig> = {}): Clock => ({
	kind: "clock",
	cfg: { ...CLOCK_DEFAULTS, face, ...over },
});
const combo = (
	face: FaceId,
	active: string,
	time: string,
	extra: Partial<ClockConfig["colors"]> = {},
): Clock =>
	clock(face, { colors: { ...CLOCK_DEFAULTS.colors, active, time, ...extra } });

/** The image the device shows at `nowMs`: the plugin draws on a 100 ms grid at most. */
function keySvg(k: Key, nowMs: number, cd?: Countdown): string {
	const t = Math.floor(nowMs / 100) * 100;
	if (k.kind === "countdown") {
		const view = cd ? viewCountdown(cd, t) : null;
		return renderCountdownKey(view, k.durationSec, k.color);
	}
	const m = buildFaceModel(
		t,
		k.cfg,
		cd ? { countdown: cd, view: viewCountdown(cd, t) } : undefined,
	);
	return renderFace(k.cfg.face, m, k.cfg.colors, animState(m, k.cfg));
}

function scene(
	keys: Key[],
	nowMs: number,
	w: number,
	h: number,
	cd?: Countdown,
): string {
	const size = Math.round(Math.min(w / (keys.length * 1.32 + 0.4), h * 0.62));
	const gap = Math.round(size * 0.32);
	const total = keys.length * size + (keys.length - 1) * gap;
	const x0 = Math.round((w - total) / 2);
	const y0 = Math.round((h - size) / 2 - size * 0.04);
	let body = "";
	keys.forEach((k, i) => {
		const x = x0 + i * (size + gap);
		const inner = keySvg(k, nowMs, cd)
			.replace(/^<svg[^>]*>/, "")
			.replace(/<\/svg>$/, "")
			.replace(/id="glow"/g, `id="glow${i}"`)
			.replace(/url\(#glow\)/g, `url(#glow${i})`);
		// soft floor shadow under the object, as on the site's stages
		body += `<ellipse cx="${x + size / 2}" cy="${y0 + size + size * 0.07}" rx="${size * 0.42}" ry="${size * 0.06}" fill="#000" opacity=".24" filter="url(#blur)"/>`;
		body += `<svg x="${x}" y="${y0}" width="${size}" height="${size}" viewBox="0 0 144 144"><clipPath id="c${i}"><rect width="144" height="144" rx="20"/></clipPath><g clip-path="url(#c${i})">${inner}</g></svg>`;
	});
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="stage" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${STAGE_TOP}"/><stop offset="1" stop-color="${STAGE_BOTTOM}"/></linearGradient><filter id="blur" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="${(size / 220) * 8.5}"/></filter></defs><rect width="100%" height="100%" fill="url(#stage)"/>${body}</svg>`;
}

const render = (svg: string, width?: number) =>
	new Resvg(svg, {
		fitTo: width ? { mode: "width", value: width } : { mode: "original" },
		font: {
			fontFiles: FONTS,
			loadSystemFonts: false,
			defaultFontFamily: "Barlow",
		},
	})
		.render()
		.asPng();

function still(name: string, keys: Key[], nowMs: number, w = 1600, h = 600) {
	const svg = scene(keys, nowMs, w, h);
	writeFileSync(join(MEDIA, name), render(svg));
	// sharper rendering from the same vector scene, for high-density screens
	writeFileSync(
		join(MEDIA, name.replace(/\.png$/, "@2x.png")),
		render(svg, w * 2),
	);
}

function video(
	name: string,
	keys: Key[],
	fromMs: number,
	seconds: number,
	cdAt?: { startMs: number; durationSec: number; warn: boolean },
	w = 1600,
	h = 600,
) {
	// a fresh frame folder per video, so no frames of a previous one remain
	rmSync(FRAMES, { recursive: true, force: true });
	mkdirSync(FRAMES, { recursive: true });
	const fps = 30;
	for (let f = 0; f < seconds * fps; f++) {
		const t = fromMs + Math.round((f * 1000) / fps);
		const cd: Countdown | undefined =
			cdAt && t >= cdAt.startMs
				? {
						deviceId: "d",
						sourceActionId: "cd",
						startMs: cdAt.startMs,
						durationMs: cdAt.durationSec * 1000,
						endMode: "overtime",
						warn: cdAt.warn,
					}
				: undefined;
		writeFileSync(
			join(FRAMES, `f${String(f).padStart(4, "0")}.png`),
			render(scene(keys, t, w, h, cd)),
		);
	}
	execFileSync(FFMPEG, [
		"-y",
		"-loglevel",
		"error",
		"-framerate",
		String(fps),
		"-i",
		join(FRAMES, "f%04d.png"),
		"-c:v",
		"libx264",
		"-pix_fmt",
		"yuv420p",
		"-crf",
		name.includes("@2x") ? "25" : "20",
		"-preset",
		"slow",
		"-movflags",
		"+faststart",
		join(MEDIA, name),
	]);
	copyFileSync(join(MEDIA, name), join(VIDEOS, name));
}

// Ring/time colour pairs (Marc: show the variety, ring and time apart). Red default once.
const CYAN = "#32D5FF",
	WHITE = "#FFFFFF",
	YELLOW = "#FFE600",
	PURPLE = "#BF5AF2";
const AMBER = "#FFA516",
	PINK = "#FF5FD2",
	MINT = "#3DFFB5";

// 1. The five faces (still): default red Classic, the others in pairs
const faces: Key[] = [
	clock("classic"),
	combo("modern", PURPLE, WHITE),
	combo("line", CYAN, YELLOW),
	combo("comet", AMBER, WHITE),
	combo("big", PINK, WHITE),
];
still("onairclock-v2-faces.png", faces, at(10, 8, 30, 350));

// 2. Ring and time in their own colours (still)
const combos: Key[] = [
	combo("classic", "#FF3B2F", "#1B1B1A", {
		background: "#FFFFFF",
		inactive: "#C8C8C8",
	}),
	combo("modern", "#32D5FF", "#FFFFFF"),
	combo("line", "#FFB000", "#FFFFFF"),
	combo("comet", "#FF2D92", "#32D5FF"),
	combo("big", "#30D158", "#FFFFFF"),
];
still("onairclock-v2-colours.png", combos, at(10, 8, 30, 350));

// 3. World clocks with labels (still)
const pair = (active: string, time: string) => ({
	...CLOCK_DEFAULTS.colors,
	active,
	time,
});
const world: Key[] = [
	clock("classic", { label: "BER", colors: pair(CYAN, WHITE) }),
	clock("line", {
		label: "LDN",
		zone: { kind: "iana", zone: "Europe/London" },
		colors: pair(PINK, WHITE),
	}),
	clock("modern", {
		label: "NYC",
		zone: { kind: "iana", zone: "America/New_York" },
		colors: pair(AMBER, WHITE),
	}),
	clock("line", {
		label: "VAN",
		zone: { kind: "iana", zone: "America/Vancouver" },
		colors: pair(MINT, YELLOW),
	}),
	clock("classic", {
		label: "TYO",
		zone: { kind: "iana", zone: "Asia/Tokyo" },
		colors: pair(PURPLE, WHITE),
	}),
];
still("onairclock-v2-world-clocks.png", world, at(20, 48, 30, 350));

// 4. Smooth sweep across a minute change (source video, 10 s)
video("onairclock-v2-faces.mp4", faces, at(20, 48, 54), 10);
video(
	"onairclock-v2-faces@2x.mp4",
	faces,
	at(20, 48, 54),
	10,
	undefined,
	3200,
	1200,
);

// 5. Countdown: idle, start, warning, zero, overtime (source video, 10 s)
const cdKeys: Key[] = [
	combo("classic", CYAN, WHITE),
	combo("line", PURPLE, YELLOW),
	combo("big", MINT, WHITE),
	{ kind: "countdown", durationSec: 8, color: AMBER },
];
video("onairclock-v2-countdown.mp4", cdKeys, at(20, 48, 10), 10, {
	startMs: at(20, 48, 11),
	durationSec: 8,
	warn: true,
});
video(
	"onairclock-v2-countdown@2x.mp4",
	cdKeys,
	at(20, 48, 10),
	10,
	{ startMs: at(20, 48, 11), durationSec: 8, warn: true },
	3200,
	1200,
);

// 6. Native key renders per face for the hero (288 px, default colours)
mkdirSync(join(OUT, "faces"), { recursive: true });
for (const f of FACES) {
	const svg = keySvg(clock(f), at(10, 8, 30, 350)); // hero reference: default colours
	writeFileSync(join(OUT, "faces", `${f}-288.png`), render(svg, 288));
	writeFileSync(join(OUT, "faces", `${f}-576.png`), render(svg, 576));
}
rmSync(FRAMES, { recursive: true, force: true });
console.log("ok", OUT);
