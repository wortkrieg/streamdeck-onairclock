// THROWAWAY hardware spike. See docs/superpowers/notes/2026-11-spike-findings.md
import {
	appendFileSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import streamDeck, {
	action,
	type KeyDownEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

/* ---------- facts (Step 2) ---------- */
const here = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.resolve(here, "..", "logs");
function vancouverOffset(): string {
	return (
		new Intl.DateTimeFormat("en-US", {
			timeZone: "America/Vancouver",
			timeZoneName: "longOffset",
		})
			.formatToParts(new Date("2026-11-11T12:00:00Z"))
			.find((p) => p.type === "timeZoneName")?.value ?? "unknown"
	);
}
function logFacts(): void {
	const facts = {
		node: process.version,
		icu: process.versions.icu,
		tz: process.versions.tz,
		vancouverOffset_2026_11_11: vancouverOffset(),
		pid: process.pid,
		at: new Date().toISOString(),
	};
	streamDeck.logger.info(`spike-facts ${JSON.stringify(facts)}`);
	try {
		mkdirSync(logsDir, { recursive: true });
		writeFileSync(
			path.join(logsDir, "spike-facts.json"),
			JSON.stringify(facts, null, 2),
		);
	} catch (e) {
		streamDeck.logger.error(`could not write spike-facts.json: ${e}`);
	}
}
function note(msg: string): void {
	streamDeck.logger.info(msg);
	try {
		mkdirSync(logsDir, { recursive: true });
		appendFileSync(path.join(logsDir, "spike-steps.log"), `${msg}\n`);
	} catch {}
}

/* ---------- glyphs (copied from mockup) ---------- */
const TAU = Math.PI * 2;
const G: Record<string, string> = {
	"0": "M5 0A5 5 0 0 1 10 5V11A5 5 0 0 1 0 11V5A5 5 0 0 1 5 0Z",
	"1": "M2 3.4L6.2 0V16",
	"2": "M0.4 4.6A4.8 4.6 0 1 1 8.4 8L0 16H10",
	"3": "M0.6 0H9.4L4.3 6.2A4.9 4.9 0 1 1 0.3 13.6",
	"4": "M7.4 16V0L0 11.2H10",
	"5": "M9.4 0H1.6L1 6.8A5 5 0 1 1 0.3 14",
	"6": "M7.6 0L0.9 8.2M10 11A5 5 0 1 1 0 11A5 5 0 1 1 10 11Z",
	"7": "M0 0H10L3.6 16",
	"8": "M5 7.4A3.7 3.7 0 1 1 5 0A3.7 3.7 0 1 1 5 7.4ZM5 7.4A4.3 4.3 0 1 0 5 16A4.3 4.3 0 1 0 5 7.4Z",
	"9": "M10 5A5 5 0 1 1 0 5A5 5 0 1 1 10 5ZM9.1 7.8L2.4 16",
};
const GW: Record<string, number> = { ":": 4 };
function digits(
	str: string,
	cx: number,
	cy: number,
	h: number,
	sw: number,
	color: string,
): string {
	const sc = h / 16;
	const gap = 3.4;
	const chars = [...str];
	const w = chars.reduce((a, c) => a + (GW[c] ?? 10) + gap, -gap);
	let x = -w / 2;
	let out = "";
	const swU = sw / sc;
	for (const ch of chars) {
		const gw = GW[ch] ?? 10;
		if (ch === ":") {
			out += `<g stroke="none" fill="${color}"><circle cx="${x + 2}" cy="4.6" r="${swU * 0.62}"/><circle cx="${x + 2}" cy="11.4" r="${swU * 0.62}"/></g>`;
		} else if (G[ch]) {
			out += `<path d="${G[ch]}" transform="translate(${x} 0)"/>`;
		}
		x += gw + gap;
	}
	return `<g transform="translate(${cx} ${cy}) scale(${sc}) translate(0 -8)" fill="none" stroke="${color}" stroke-width="${swU}" stroke-linecap="round" stroke-linejoin="round">${out}</g>`;
}
const P = (r: number, f: number): [number, number] => [
	72 + r * Math.sin(f * TAU),
	72 - r * Math.cos(f * TAU),
];
function arc(r: number, f0: number, f1: number): string {
	if (f1 - f0 <= 0.0005) return "";
	if (f1 - f0 >= 0.9995)
		return `M72 ${72 - r}A${r} ${r} 0 1 1 72 ${72 + r}A${r} ${r} 0 1 1 72 ${72 - r}`;
	const [x0, y0] = P(r, f0);
	const [x1, y1] = P(r, f1);
	return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${f1 - f0 > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/* ---------- test images ---------- */
const C = "#FF3B2F";
const svg = (body: string, defs = "") =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><defs>${defs}</defs><rect width="144" height="144" fill="#000"/>${body}</svg>`;

function lineFace(
	frac: number,
	main: string,
	sub: string,
	id = "gl",
	label = "",
): string {
	const [hx, hy] = P(61, frac);
	const defs = `<radialGradient id="${id}"><stop offset="0" stop-color="${C}" stop-opacity=".55"/><stop offset=".45" stop-color="${C}" stop-opacity=".18"/><stop offset="1" stop-color="${C}" stop-opacity="0"/></radialGradient>`;
	const body =
		`<circle cx="72" cy="72" r="61" fill="none" stroke="${C}" stroke-opacity=".24" stroke-width="1.5"/>` +
		`<path d="${arc(61, 0, frac)}" fill="none" stroke="${C}" stroke-width="4" stroke-linecap="round"/>` +
		`<circle cx="${hx}" cy="${hy}" r="14.7" fill="url(#${id})"/><circle cx="${hx}" cy="${hy}" r="4.6" fill="${C}"/>` +
		digits(main, 72, 66, 23, 2.9, C) +
		digits(sub, 72, 96, 11, 2, C) +
		(label ? digits(label, 72, 124, 9, 1.6, "#FFFFFF") : "");
	return svg(body, defs);
}

const t1 = () =>
	svg(
		// left: radial gradient glow, right: stacked translucent circles
		`<circle cx="36" cy="72" r="30" fill="url(#g1)"/><circle cx="36" cy="72" r="5" fill="${C}"/>` +
			[30, 22, 14, 8]
				.map(
					(r) =>
						`<circle cx="108" cy="72" r="${r}" fill="${C}" fill-opacity=".15"/>`,
				)
				.join("") +
			`<circle cx="108" cy="72" r="5" fill="${C}"/>`,
		`<radialGradient id="g1"><stop offset="0" stop-color="${C}" stop-opacity=".55"/><stop offset=".45" stop-color="${C}" stop-opacity=".18"/><stop offset="1" stop-color="${C}" stop-opacity="0"/></radialGradient>`,
	);
const t2 = () =>
	svg(digits("12:34", 72, 50, 30, 4, C) + digits("56", 72, 100, 22, 3, C));
const t3 = () =>
	svg(
		`<g opacity=".4"><circle cx="40" cy="40" r="26" fill="${C}"/><rect x="70" y="20" width="50" height="40" fill="${C}"/></g>` +
			`<circle cx="40" cy="104" r="22" fill="none" stroke="${C}" stroke-width="8" stroke-opacity=".3"/>` +
			`<path d="M80 104H124" stroke="${C}" stroke-width="10" stroke-linecap="round" stroke-opacity=".5"/>`,
	);
const t4 = () =>
	svg(
		`<text x="72" y="60" text-anchor="middle" font-family="sans-serif" font-size="32" fill="${C}">NYC</text>` +
			`<text x="72" y="110" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#fff">Vancouver</text>`,
	);
const t5Svg = () => lineFace(0.4, "12:34", "56");
const b64 = (s: string) =>
	`data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`;
const utf8 = (s: string) => `data:image/svg+xml;charset=utf8,${s}`;
const uri = (s: string) => `data:image/svg+xml,${encodeURIComponent(s)}`;

const FPS = [4, 8, 12, 20, 30];
type Step = { label: string; image?: string; fps?: number };
const steps: Step[] = [
	{
		label: "1 glow: radialGradient (left) vs stackedCircles (right)",
		image: b64(t1()),
	},
	{ label: "2 nested transforms + round linecap", image: b64(t2()) },
	{ label: "3 g opacity + stroke-opacity", image: b64(t3()) },
	{ label: "4 text sans-serif NYC", image: b64(t4()) },
	{ label: "5a data uri base64", image: b64(t5Svg()) },
	{ label: "5b data uri charset=utf8 raw", image: utf8(t5Svg()) },
	{ label: "5c data uri encodeURIComponent", image: uri(t5Svg()) },
	...FPS.map((fps) => ({ label: `6 animation @ ${fps} fps`, fps })),
];

/* ---------- action ---------- */
@action({ UUID: "fail.marc.onairclock.spike.action" })
class Spike extends SingletonAction {
	// Hardware session: one global step, so a single press switches all keys at once.
	#step = 0;
	#timers = new Map<string, NodeJS.Timeout>();

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		if (!ev.action.isKey()) return;
		await this.#show(ev.action, this.#step);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		const old = this.#timers.get(ev.action.id);
		if (old) clearInterval(old);
		this.#timers.delete(ev.action.id);
	}

	override async onKeyDown(): Promise<void> {
		await this.setStep((this.#step + 1) % steps.length);
	}

	async setStep(i: number): Promise<void> {
		this.#step = ((i % steps.length) + steps.length) % steps.length;
		note(`global step ${this.#step}: ${(steps[this.#step] as Step).label}`);
		for (const a of this.actions) {
			if (a.isKey()) await this.#show(a, this.#step);
		}
	}

	// Gallery: key n (row-major) shows image step n, so all image tests are visible at once.
	async gallery(): Promise<void> {
		const blank = b64(
			'<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" fill="#000"/></svg>',
		);
		for (const a of this.actions) {
			if (!a.isKey()) continue;
			const c = a.coordinates;
			const idx = c ? c.row * 5 + c.column : -1;
			const step = steps[idx];
			if (idx >= 0 && step?.image) await this.#show(a, idx);
			else {
				const old = this.#timers.get(a.id);
				if (old) clearInterval(old);
				this.#timers.delete(a.id);
				await a.setImage(blank);
			}
		}
		note("gallery shown");
	}

	async #show(a: KeyDownEvent["action"], i: number): Promise<void> {
		const old = this.#timers.get(a.id);
		if (old) clearInterval(old);
		this.#timers.delete(a.id);
		const step = steps[i] as Step;
		note(
			`key ${a.id.slice(0, 6)} step ${i}: ${step.label} (pid ${process.pid})`,
		);
		if (step.image) {
			await a.setImage(step.image);
			return;
		}
		const fps = step.fps as number;
		let frames = 0;
		let busy = 0;
		const t0 = Date.now();
		const timer = setInterval(() => {
			const s = Date.now();
			const f = ((s - t0) / 1000 / 20) % 1;
			void a.setImage(
				b64(
					lineFace(
						f,
						"12:34",
						String(Math.floor(f * 60)).padStart(2, "0"),
						"glx",
						String(fps),
					),
				),
			);
			busy += Date.now() - s;
			frames++;
			if (frames % (fps * 10) === 0) {
				note(
					`fps ${fps}: ${frames} frames, ${(Date.now() - t0) / 1000}s, avg sync cost ${(busy / frames).toFixed(2)}ms`,
				);
			}
		}, 1000 / fps);
		this.#timers.set(a.id, timer);
	}
}

const spikeAction = new Spike();
streamDeck.actions.registerAction(spikeAction);

/* ---------- hardware-session remote control ----------
 * Write one command into logs/cmd.txt: "page <0-based index>", "step <index>" or "back".
 * The bundled profile (manifest "Profiles") lets the plugin switch the MK.2 page itself.
 */
const PROFILE = "profiles/onair-v2-test";
const cmdFile = path.join(logsDir, "cmd.txt");
function mk2(): string | undefined {
	let id: string | undefined;
	streamDeck.devices.forEach((d) => {
		if (!id && d.isConnected && d.type === 0 && d.name === "Stream Deck 5")
			id = d.id;
	});
	return id;
}
async function runCommand(line: string): Promise<void> {
	const [cmd, arg] = line.trim().split(/\s+/);
	const dev = mk2();
	if (cmd === "step") return spikeAction.setStep(Number(arg));
	if (cmd === "gallery") return spikeAction.gallery();
	if (cmd === "devices") {
		streamDeck.devices.forEach((d) => {
			note(
				`device ${d.id} type=${d.type} name=${d.name} connected=${d.isConnected}`,
			);
		});
		return;
	}
	if (!dev) throw new Error("no connected Stream Deck (type 0)");
	if (cmd === "page")
		return streamDeck.profiles.switchToProfile(dev, PROFILE, Number(arg));
	if (cmd === "back") return streamDeck.profiles.switchToProfile(dev);
	if (cmd === "v1")
		return streamDeck.profiles.switchToProfile(dev, "profiles/onair-v1-ref", 0);
	throw new Error(`unknown command ${line}`);
}
setInterval(() => {
	let line = "";
	try {
		line = readFileSync(cmdFile, "utf8");
	} catch {
		return;
	}
	if (!line.trim()) return;
	writeFileSync(cmdFile, "");
	runCommand(line).then(
		() => note(`cmd ok: ${line.trim()} @ ${new Date().toISOString()}`),
		(e) => note(`cmd failed: ${line.trim()}: ${e}`),
	);
}, 300);

logFacts();
streamDeck.connect();
