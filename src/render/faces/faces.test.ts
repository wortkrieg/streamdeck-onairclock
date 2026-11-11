import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { buildFaceModel, type FaceModel } from "../../core/clock-model";
import { type Countdown, viewCountdown } from "../../core/countdown";
import {
	CLOCK_DEFAULTS,
	type ClockConfig,
	type EndMode,
	type FaceId,
} from "../../core/settings";
import { renderCountdownKey } from "../countdown-key";
import { GLYPHS } from "../digits";
import {
	type AnimState,
	type FaceStyle,
	renderFace,
	STATIC_ANIM,
} from "./index";

// 2026-11-11 16:59:53.250 local time (vitest runs with TZ=Europe/Berlin).
const NOW = new Date(2026, 10, 11, 16, 59, 53, 250).getTime();
const MINUTE = new Date(2026, 10, 11, 17, 0, 0, 0).getTime();
const STYLE: FaceStyle = {
	active: "#FF3B2F",
	inactive: "#3D3D3D",
	background: "#000000",
};
const FACES: readonly FaceId[] = ["classic", "modern", "line", "comet", "big"];

const cfg = (face: FaceId, over: Partial<ClockConfig> = {}): ClockConfig => ({
	...CLOCK_DEFAULTS,
	face,
	...over,
});
const clock = (face: FaceId, over: Partial<ClockConfig> = {}, now = NOW) =>
	buildFaceModel(now, cfg(face, over));

// Countdown of 5 s; `elapsedMs` since start decides the phase.
const PHASES: Record<string, { endMode: EndMode; elapsedMs: number }> = {
	running: { endMode: "overtime", elapsedMs: 1800 }, // "00:04", ring 4/5
	overtime: { endMode: "overtime", elapsedMs: 6300 },
	hold: { endMode: "hold", elapsedMs: 7400 },
	flash: { endMode: "clock", elapsedMs: 6100 },
	finished: { endMode: "clock", elapsedMs: 9000 },
};
const countdownModel = (face: FaceId, phase: string, warn = false) => {
	const p = PHASES[phase];
	if (!p) throw new Error(phase);
	const c: Countdown = {
		deviceId: "d",
		sourceActionId: "a",
		startMs: NOW - p.elapsedMs,
		durationMs: 5000,
		endMode: p.endMode,
		warn,
	};
	return buildFaceModel(NOW, cfg(face), {
		countdown: c,
		view: viewCountdown(c, NOW),
	});
};

const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
const fillCircles = (s: string, color: string): number =>
	count(s, new RegExp(`<circle [^>]*fill="${color}"`, "g"));
// renderDigits groups: translate(cx cy) scale(..)
const digitGroups = (s: string): number =>
	count(s, /<g transform="translate\([^)]*\) scale\(/g);
const arcPaths = (s: string, r: number): number =>
	count(s, new RegExp(`<path d="M[^"]*A${r} ${r} `, "g"));

function expectWellFormed(svg: string): void {
	expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 144 144"/);
	expect(svg.endsWith("</svg>")).toBe(true);
	expect(count(svg, /<g[ >]/g)).toBe(count(svg, /<\/g>/g));
	expect(count(svg, /<text[ >]/g)).toBe(count(svg, /<\/text>/g));
	expect(svg).not.toMatch(/NaN|undefined|Infinity/);
}

// Preview files for a visual check in the browser (build/ is gitignored).
const PREVIEW_DIR = join(process.cwd(), "build", "preview");
function preview(name: string, svg: string): void {
	mkdirSync(PREVIEW_DIR, { recursive: true });
	writeFileSync(join(PREVIEW_DIR, `${name}.svg`), svg);
}

/** Re-imports the renderers with patched hardware constants. */
async function withHardware(patch: Record<string, unknown>) {
	vi.resetModules();
	vi.doMock("../../hardware", async (importOriginal) => ({
		...(await importOriginal<object>()),
		...patch,
	}));
	return {
		...(await import("./index")),
		...(await import("../../core/clock-model")),
	};
}

afterEach(() => {
	vi.doUnmock("../../hardware");
	vi.resetModules();
});

describe("renderFace", () => {
	test("every face returns a complete 144x144 svg", () => {
		for (const face of FACES) {
			expectWellFormed(renderFace(face, clock(face), STYLE, STATIC_ANIM));
		}
	});

	test("classic at step 54: 54 active dots, 6 inactive dots, 12 hour markers", () => {
		const m = clock("classic");
		expect(m.step).toBe(54);
		const svg = renderFace("classic", m, STYLE, STATIC_ANIM);
		expect(fillCircles(svg, STYLE.active)).toBe(54);
		// hour markers use the inactive color (V1 parity): 6 inactive dots + 12 markers
		expect(fillCircles(svg, STYLE.inactive)).toBe(18);
	});

	test("every face renders every countdown phase", () => {
		for (const face of FACES) {
			for (const phase of Object.keys(PHASES)) {
				const m = countdownModel(face, phase, true);
				expect(m.mode).toBe(phase === "finished" ? "clock" : "countdown");
				expectWellFormed(renderFace(face, m, STYLE, STATIC_ANIM));
			}
		}
	});

	test("every face renders with animation in progress", () => {
		const anims: AnimState[] = [
			{ ...STATIC_ANIM, roll: 0.5, wipe: 0.3, glow: 0.8, colonOpacity: 0.2 },
			{ ...STATIC_ANIM, pulse: 0.7, ringOn: false, flash: true },
		];
		for (const face of FACES) {
			for (const a of anims) {
				expectWellFormed(renderFace(face, clock(face, {}, MINUTE), STYLE, a));
				expectWellFormed(
					renderFace(face, countdownModel(face, "overtime"), STYLE, a),
				);
			}
		}
	});

	test("line at fraction 0 draws no arc, only the background ring", () => {
		const m = clock("line", {}, MINUTE);
		expect(m.fraction).toBe(0);
		const svg = renderFace("line", m, STYLE, STATIC_ANIM);
		expect(arcPaths(svg, 64)).toBe(0);
		expect(svg).toContain(
			`<circle cx="72" cy="72" r="64" fill="none" stroke="${STYLE.inactive}"`,
		);
		expect(
			arcPaths(renderFace("line", clock("line"), STYLE, STATIC_ANIM), 64),
		).toBe(1);
	});

	test("big shows main split into two lines", () => {
		const svg = renderFace("big", clock("big"), STYLE, STATIC_ANIM);
		expect(digitGroups(svg)).toBe(2);
		const at = (g: string) => svg.indexOf(`d="${GLYPHS[g]}"`);
		expect(at("1")).toBeGreaterThan(-1);
		expect(at("1")).toBeLessThan(at("6"));
		expect(at("6")).toBeLessThan(at("5"));
		expect(at("5")).toBeLessThan(at("9"));
		expect(svg).not.toContain("<circle"); // no colon
		const ys = [...svg.matchAll(/translate\(72 ([\d.]+)\) scale/g)].map((x) =>
			Number(x[1]),
		);
		expect(ys).toHaveLength(2);
		expect(ys[0]).toBeLessThan(ys[1] ?? 0);
	});

	test("overtime shows the + sign on every face, running and hold do not", () => {
		const plus = `d="${GLYPHS["+"]}"`;
		for (const face of FACES) {
			const over = renderFace(
				face,
				countdownModel(face, "overtime"),
				STYLE,
				STATIC_ANIM,
			);
			expect(over.split(plus)).toHaveLength(2); // exactly one "+"
			for (const phase of ["running", "hold"]) {
				expect(
					renderFace(face, countdownModel(face, phase), STYLE, STATIC_ANIM),
				).not.toContain(plus);
			}
		}
	});

	test("stacked faces: small + left of the top row, digits stay two large rows", () => {
		const plus = `d="${GLYPHS["+"]}"`;
		for (const face of ["modern", "comet", "big"] as const) {
			const svg = renderFace(
				face,
				countdownModel(face, "overtime"),
				STYLE,
				STATIC_ANIM,
			);
			// no nested groups here (no colon), so a lazy match per digit group works
			const groups = [
				...svg.matchAll(
					/<g transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)[^>]*>(.*?)<\/g>/g,
				),
			].map((g) => ({
				x: Number(g[1]),
				y: Number(g[2]),
				scale: Number(g[3]),
				isPlus: (g[4] ?? "").includes(plus),
			}));
			const sign = groups.find((g) => g.isPlus);
			const rows = groups.filter((g) => !g.isPlus).sort((p, q) => p.y - q.y);
			expect(rows).toHaveLength(2);
			const [top, bottom] = rows;
			expect(sign).toBeDefined();
			if (!sign || !top || !bottom) return;
			expect(sign.y).toBe(top.y); // vertically centred on the top row
			expect(sign.x).toBeLessThan(top.x); // left of it
			expect(sign.scale).toBeLessThan(top.scale); // smaller
			expect(top.scale).toBe(bottom.scale); // MM and SS keep their size
		}
	});

	test("options: date only on classic, seconds not on comet and big", () => {
		// main + date + sub on classic
		expect(
			digitGroups(renderFace("classic", clock("classic"), STYLE, STATIC_ANIM)),
		).toBe(3);
		// a classic model (with date) on line/modern: date is not drawn
		const withDate = clock("classic");
		expect(digitGroups(renderFace("line", withDate, STYLE, STATIC_ANIM))).toBe(
			2,
		);
		expect(
			digitGroups(renderFace("modern", withDate, STYLE, STATIC_ANIM)),
		).toBe(3); // hh, mm, ss
		expect(digitGroups(renderFace("comet", withDate, STYLE, STATIC_ANIM))).toBe(
			2,
		);
		expect(digitGroups(renderFace("big", withDate, STYLE, STATIC_ANIM))).toBe(
			2,
		);
		expect(
			digitGroups(
				renderFace(
					"modern",
					clock("modern", { showSeconds: false }),
					STYLE,
					STATIC_ANIM,
				),
			),
		).toBe(2);
	});

	test("pm indicator adds exactly one dot", () => {
		for (const face of FACES) {
			const am = renderFace(
				face,
				clock(face, { hour12: true }),
				STYLE,
				STATIC_ANIM,
			);
			const pm = renderFace(
				face,
				clock(face, { hour12: true, pmIndicator: true }),
				STYLE,
				STATIC_ANIM,
			);
			expect(fillCircles(pm, STYLE.active)).toBe(
				fillCircles(am, STYLE.active) + 1,
			);
		}
	});

	test("label replaces the date when text is supported", async () => {
		const h = await withHardware({ TEXT_SUPPORTED: true });
		const svg = h.renderFace(
			"classic",
			h.buildFaceModel(NOW, cfg("classic", { label: "NYC" })),
			STYLE,
			STATIC_ANIM,
		);
		expect(svg).toMatch(
			/<text [^>]*font-family="Barlow, Arial, sans-serif"[^>]*text-anchor="middle"[^>]*>NYC<\/text>/,
		);
		expect(svg).toContain(`fill="${STYLE.active}"`);
		expect(digitGroups(svg)).toBe(2); // main + sub, no date
	});

	test("long labels shrink to stay inside the face", async () => {
		const h = await withHardware({ TEXT_SUPPORTED: true });
		const size = (text: string) => {
			const svg = h.renderFace(
				"classic",
				h.buildFaceModel(NOW, cfg("classic", { label: text })),
				STYLE,
				STATIC_ANIM,
			);
			return Number(/font-size="([\d.]+)"/.exec(svg)?.[1]);
		};
		expect(size("NYC")).toBe(20);
		expect(size("LONDON")).toBeLessThan(20);
		expect(size("LONDON") * 6 * 0.7).toBeLessThanOrEqual(76);
	});

	test("no label in the svg when text is not supported", async () => {
		const h = await withHardware({ TEXT_SUPPORTED: false });
		const svg = h.renderFace(
			"classic",
			h.buildFaceModel(NOW, cfg("classic", { label: "NYC" })),
			STYLE,
			STATIC_ANIM,
		);
		expect(svg).not.toContain("<text");
		expect(svg).not.toContain("NYC");
		expect(digitGroups(svg)).toBe(3); // date stays
	});

	test("label only on classic, modern and line; text is escaped", () => {
		const m = (face: FaceId): FaceModel => ({
			...clock(face),
			label: `R&D<"'>`,
		});
		for (const face of ["classic", "modern", "line"] as const) {
			expect(renderFace(face, m(face), STYLE, STATIC_ANIM)).toContain(
				">R&amp;D&lt;&quot;&#39;&gt;</text>",
			);
		}
		for (const face of ["comet", "big"] as const) {
			expect(renderFace(face, m(face), STYLE, STATIC_ANIM)).not.toContain(
				"<text",
			);
		}
	});

	test("countdown ring blinks via ringOn outside the running phase", () => {
		const on = { ...STATIC_ANIM, ringOn: true };
		const off = { ...STATIC_ANIM, ringOn: false };
		for (const phase of ["overtime", "hold", "flash"]) {
			const classic = countdownModel("classic", phase);
			expect(
				fillCircles(renderFace("classic", classic, STYLE, on), STYLE.active),
			).toBe(60);
			expect(
				fillCircles(renderFace("classic", classic, STYLE, off), STYLE.active),
			).toBe(0);
			const line = countdownModel("line", phase);
			expect(arcPaths(renderFace("line", line, STYLE, on), 64)).toBe(1);
			expect(arcPaths(renderFace("line", line, STYLE, off), 64)).toBe(0);
		}
		// running shows the remaining fraction regardless of ringOn
		const running = countdownModel("classic", "running");
		expect(
			fillCircles(renderFace("classic", running, STYLE, off), STYLE.active),
		).toBe(48);
	});

	test("countdown start (fraction 1) keeps the moving head", () => {
		const c: Countdown = {
			deviceId: "d",
			sourceActionId: "a",
			startMs: NOW,
			durationMs: 5000,
			endMode: "overtime",
			warn: false,
		};
		const at = (face: FaceId) =>
			renderFace(
				face,
				buildFaceModel(NOW, cfg(face), {
					countdown: c,
					view: viewCountdown(c, NOW),
				}),
				STYLE,
				STATIC_ANIM,
			);
		expect(at("line")).toContain('fill="url(#glow)"'); // head halo
		const comet = at("comet");
		expect(arcPaths(comet, 64)).toBeGreaterThan(0); // tail, not the full ring
		expect(comet).not.toContain('stroke-width="2.4"');
	});

	test("wipe only in clock mode", () => {
		const a = { ...STATIC_ANIM, wipe: 0.2 };
		const atMinute = renderFace(
			"classic",
			clock("classic", {}, MINUTE),
			STYLE,
			a,
		);
		expect(fillCircles(atMinute, STYLE.active)).toBeGreaterThan(1);
		const cdm = countdownModel("classic", "running");
		expect(
			fillCircles(renderFace("classic", cdm, STYLE, a), STYLE.active),
		).toBe(48);
	});

	test("afterglow on classic only while glow > 0", () => {
		const m = clock("classic");
		const glowing = renderFace("classic", m, STYLE, {
			...STATIC_ANIM,
			glow: 0.5,
		});
		expect(glowing).toContain('fill="url(#glow)"');
		expect(renderFace("classic", m, STYLE, STATIC_ANIM)).not.toContain(
			"url(#glow)",
		);
	});

	test("flash and pulse wrap the face", () => {
		const svg = renderFace("line", countdownModel("line", "flash"), STYLE, {
			...STATIC_ANIM,
			flash: true,
			pulse: 0.7,
		});
		expect(svg).toContain(
			`<rect width="144" height="144" fill="${STYLE.active}" opacity="0.22"/>`,
		);
		expect(svg).toContain(`<g opacity="0.7">`);
		const plain = renderFace("line", clock("line"), STYLE, STATIC_ANIM);
		expect(plain).not.toContain('opacity="0.22"');
		expect(plain).not.toMatch(/<g opacity="[\d.]+">/); // colon groups carry more attributes
	});

	test("glow technique: radial gradient defined once", async () => {
		const h = await withHardware({ GLOW_TECHNIQUE: "radialGradient" });
		const svg = h.renderFace(
			"line",
			h.buildFaceModel(NOW, cfg("line")),
			STYLE,
			{
				...STATIC_ANIM,
				glow: 0.5,
			},
		);
		expect(count(svg, /<radialGradient id="glow"/g)).toBe(1);
		expect(svg).toContain('fill="url(#glow)"');
		expectWellFormed(svg);
	});

	test("glow technique: stacked circles need no defs", async () => {
		const h = await withHardware({ GLOW_TECHNIQUE: "stackedCircles" });
		const svg = h.renderFace(
			"line",
			h.buildFaceModel(NOW, cfg("line")),
			STYLE,
			STATIC_ANIM,
		);
		expect(svg).not.toContain("<defs");
		expect(count(svg, /fill-opacity=/g)).toBeGreaterThanOrEqual(3);
	});

	describe("snapshots", () => {
		for (const face of FACES) {
			test(`${face} clock`, () => {
				const svg = renderFace(
					face,
					clock(face, {
						hour12: face === "modern",
						pmIndicator: true,
						label: face === "line" ? "NYC" : "",
					}),
					STYLE,
					STATIC_ANIM,
				);
				preview(`${face}-clock`, svg);
				expect(svg).toMatchSnapshot();
			});
			test(`${face} countdown`, () => {
				const svg = renderFace(
					face,
					countdownModel(face, "running"),
					STYLE,
					STATIC_ANIM,
				);
				preview(`${face}-countdown`, svg);
				expect(svg).toMatchSnapshot();
			});
		}
		test("preview extras", () => {
			// Not snapshotted: overtime, animation frames and a light theme for the visual check.
			for (const face of FACES) {
				preview(
					`${face}-overtime`,
					renderFace(
						face,
						countdownModel(face, "overtime"),
						STYLE,
						STATIC_ANIM,
					),
				);
				preview(
					`${face}-anim`,
					renderFace(face, clock(face, {}, MINUTE + 120), STYLE, {
						...STATIC_ANIM,
						roll: 0.4,
						wipe: 0.25,
						glow: 0.8,
					}),
				);
				preview(
					`${face}-light`,
					renderFace(
						face,
						clock(face, { label: "BER" }),
						{ active: "#1F3BFF", inactive: "#C8CCD6", background: "#F4F4F4" },
						STATIC_ANIM,
					),
				);
			}
			expect(true).toBe(true);
		});
	});
});

describe("renderCountdownKey", () => {
	const c = (elapsedMs: number, endMode: EndMode = "overtime"): Countdown => ({
		deviceId: "d",
		sourceActionId: "a",
		startMs: NOW - elapsedMs,
		durationMs: 300_000,
		endMode,
		warn: false,
	});

	test("idle shows the duration and a start triangle, no ring", () => {
		const svg = renderCountdownKey(null, 300, "#FF3B2F");
		expectWellFormed(svg);
		expect(digitGroups(svg)).toBe(1);
		expect(svg).toContain(`d="${GLYPHS["5"]}"`);
		expect(svg).toMatch(/<path d="M[^"]*Z" fill="#FF3B2F"/); // triangle
		expect(arcPaths(svg, 64)).toBe(0);
		preview("countdown-key-idle", svg);
		expect(svg).toMatchSnapshot();
	});

	test("finished view is idle", () => {
		expect(renderCountdownKey({ phase: "finished" }, 300, "#FF3B2F")).toBe(
			renderCountdownKey(null, 300, "#FF3B2F"),
		);
	});

	test("active looks like the line face in countdown mode", () => {
		const svg = renderCountdownKey(
			viewCountdown(c(75_000), NOW),
			300,
			"#FF3B2F",
		);
		expectWellFormed(svg);
		expect(arcPaths(svg, 64)).toBe(1);
		expect(svg).toContain(`d="${GLYPHS["4"]}"`); // 03:45
		preview("countdown-key-running", svg);
		expect(svg).toMatchSnapshot();
	});

	test("every phase renders", () => {
		for (const [elapsed, mode] of [
			[301_200, "overtime"],
			[301_700, "overtime"],
			[300_400, "hold"],
			[300_100, "clock"],
		] as const) {
			const svg = renderCountdownKey(
				viewCountdown(c(elapsed, mode), NOW),
				300,
				"#3DFFB5",
			);
			expectWellFormed(svg);
			preview(`countdown-key-${mode}-${elapsed}`, svg);
		}
	});
});
