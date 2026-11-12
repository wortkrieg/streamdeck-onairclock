# On Air Clock V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Plugin wird auf dem aktuellen Elgato-SDK als TypeScript/SVG-Plugin neu gebaut. Es bekommt neue Watchfaces, Zeitzonen, eine Countdown-Aktion und ein neues Branding und ist bereit für den Elgato Marketplace.

**Architecture:** Reine, SDK-freie Module unter `src/core` (Zeit, Settings, Countdown) und `src/render` (SVG-Faces) tragen die gesamte Logik und sind vollständig getestet. Eine dünne Schicht unter `src/plugin` verbindet sie mit `@elgato/streamdeck`. Dort laufen ein gemeinsamer Takt für alle Tasten, Controller für Uhr und Countdown und die Actions. Entwickelt wird unter einer separaten Dev-Plugin-ID, damit die installierte V1 unberührt bleibt.

**Tech Stack:** TypeScript 5 (strict), `@elgato/streamdeck` ^3.0.4, `@elgato/cli` ^1.10.4, Rollup (CLI-Template), Vitest, Biome (Lint und Format), `sdpi-components` v4 für den Property Inspector, `@resvg/resvg-js` und `gifenc` für Assets, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-11-v2-design.md`. Visuelle Referenz und Render-Prototyp: `docs/superpowers/specs/2026-11-11-v2-mockups.fragment.html` (Script-Teil: `G`, `digits`, `render`, `clockModel`, `countdownModel`).

## Global Constraints

- Plugin-UUID `fail.marc.onairclock`, Uhr-Action `fail.marc.onairclock.action` (unverändert), Countdown-Action `fail.marc.onairclock.countdown`, Plugin-Ordner `fail.marc.onairclock.sdPlugin`.
- Dev-Variante: UUID `fail.marc.onairclock.dev` (Actions `fail.marc.onairclock.dev.action` und `fail.marc.onairclock.dev.countdown`), Name „On Air Clock (Dev)“. Sie wird nur nach `build/` gebaut und nie ausgeliefert.
- Manifest: `"SDKVersion": 3`, `"Software": { "MinimumVersion": "7.1" }`, `"Nodejs": { "Version": "24" }`, `"Version": "2.0.0.0"`, OS mac ≥ `"12"`, windows ≥ `"10"`.
- V1-Settings (Spec §3) werden immer gelesen. Ungültige Werte führen zum Default, nie zu einem Absturz.
- Neue Standardwerte gelten für alle Tasten ohne gespeicherten Wert, also auch für nie eingestellte V1-Uhren. Animationen an, Doppelpunkt-Blinken an, „Countdown anzeigen“ an.
- Default-Farben neu: aktiv `#FF3B2F`, inaktiv `#3D3D3D`, Hintergrund `#000000`.
- Watchfaces: `classic`, `modern`, `line`, `comet`, `big`. Ein Face über mehrere Tasten, Striche und Analog gibt es nicht.
- Ziffern werden ausschließlich mit eigenen Linienpfaden gezeichnet (`0–9 : - +`), ohne Schriftart.
- Animation: Ziffern rollen 380 ms, Ring-Reset 750 ms, Nachglühen 600 ms, Doppelpunkt sichtbar in den ersten 500 ms jeder Sekunde (sonst Deckkraft 0.2). Countdown-Warnung in den letzten 10 s, Blinken im Überziehen und beim Halten 500 ms an/aus, Aufblitzen bei „zurück zur Uhrzeit“ 2000 ms.
- Countdown: 1 s bis 99:59 (5999 s), Default 05:00. Endmodi `overtime` (Default), `hold`, `clock`. Warnung Default aus.
- UTC-Versatz von −12:00 bis +14:00 in 15-Minuten-Schritten.
- Sprachen Englisch und Deutsch.
- Branding „Farbraum“: Ultramarin `#2B3BFF`, Papier `#F2F3FF`, Tasten-Schwarz `#000000`, Rot `#FF3B2F`, Mint `#3DFFB5`, Amber `#FFA516` (Zusatz: Weiß `#F4F4F4`, Blau `#5B8CFF`, Pink `#FF5FD2`). Schriften Unbounded (Name, Überschriften) und Barlow (Text), nur im Marketing.
- Claim EN „Studio clocks in any color, on any key.“, DE „Studiouhren in jeder Farbe, auf jeder Taste.“. „Mehrere Tasten“ darf nirgends erwähnt werden.
- Asset-Größen:
  - Plugin-Icon PNG 256×256 und 512×512 (@2x)
  - Marketplace-App-Icon PNG 288×288
  - Kategorie-Icon 28/56 sowie Action-Icons 20/40, monochrom weiß auf transparent
  - Tastenbilder 72/144, Encoder-Icon 72/144
  - Marketplace-Galerie PNG 1920×960, mindestens 3 Bilder
- Kein Push, kein Posten auf GitHub, kein Löschen außerhalb des Repos ohne Freigabe des Maintainers.

## Review Focus

1. **Sommerzeitwechsel und krumme Versätze** (Europe/Berlin am 2026-10-25, Asia/Kathmandu +5:45): Die Uhr muss die korrekte Wandzeit zeigen. Getestet in Task 3.
2. **Kaputte oder fremde Settings** (`dotcolor: "red"`, `watchface: "7"`, `hourFormat: 12` als Zahl, `timezone: "Mars/Phobos"`, `duration: "5"`): Es greift der Default, kein Absturz. Getestet in Task 4.
3. **Systemuhr springt** (Ruhezustand über Stunden, NTP stellt zurück): Der Takt läuft weiter, ohne negative Delays und ohne Endlosschleife. Getestet in Task 8 und Task 9.
4. **Countdown über Seitenwechsel und Geräte-Trennung:** Die Uhr verschwindet und erscheint wieder, die Countdown-Taste liegt auf einer anderen Seite. Die Restzeit stimmt trotzdem, und Countdowns auf zwei Geräten beeinflussen sich nicht. Getestet in Task 5 und Task 10.
5. **Viele sichtbare Uhren** (15 auf dem MK.2, 32 auf dem XL): Pro Taste wird `setImage` nur aufgerufen, wenn sich das Bild geändert hat. Getestet in Task 9.

---

### Task 1: Projektgerüst, Dev-Variante, CI, V1 entfernen

**Files:**
- Create: `package.json`, `tsconfig.json`, `rollup.config.mjs`, `vitest.config.ts`, `biome.json`, `src/plugin.ts`, `src/ids.ts`, `scripts/dev-manifest.mjs`, `scripts/build-dev.mjs`, `scripts/dev-manifest.test.ts`, `.github/workflows/ci.yml`, `fail.marc.onairclock.sdPlugin/manifest.json` (neu)
- Modify: `.gitignore` (zusätzlich `build/`, `*.sdPlugin/bin`, `*.sdPlugin/logs`)
- Delete: `DistributionTool`, `release/`, `deploy.sh`, `fail.marc.onairclock.sdPlugin/{app.js,index.html,externalWindow.html,common/,propertyinspector/,layout/}`. Die Assets (`action/`, `previews/`, `pi.png`, `preview.gif`) bleiben bis Task 13 und 14.

**Interfaces:**
- Produces:
  - `src/ids.ts` exportiert `PLUGIN_UUID: string`, `CLOCK_UUID = \`${PLUGIN_UUID}.action\`` und `COUNTDOWN_UUID = \`${PLUGIN_UUID}.countdown\``. `PLUGIN_UUID` kommt aus der Build-Konstante `__PLUGIN_UUID__`: per `@rollup/plugin-replace`, in Vitest per `define` mit `"fail.marc.onairclock"`.
  - `scripts/dev-manifest.mjs` exportiert `toDevManifest(manifest: object): object`.
  - npm-Scripts: `build`, `build:dev`, `watch:dev`, `test`, `typecheck`, `lint`, `format`, `validate`.

- [ ] **Step 1: Stream Deck sichern und aktualisieren.**
  - `tar czf ~/streamdeck-backup-$(date +%Y%m%d).tgz -C ~/Library/Application\ Support com.elgato.StreamDeck`
  - Dann Stream Deck auf ≥ 7.1 bringen. Zuerst `brew list --cask | grep -i stream-deck` prüfen und gegebenenfalls `brew upgrade --cask elgato-stream-deck`. Sonst bittet der Maintainer, in der App „Nach Updates suchen“ zu wählen.
  - Prüfen: `defaults read "/Applications/Elgato Stream Deck.app/Contents/Info.plist" CFBundleShortVersionString` muss ≥ 7.1 ausgeben.
- [ ] **Step 2: Gerüst nach dem CLI-Template anlegen.**
  - Vorlage: `@elgato/cli@1.10.4/template`. `package.json`, `rollup.config.mjs` und `tsconfig.json` wie dort, zusätzlich mit `"strict": true` und `"noUncheckedIndexedAccess": true`.
  - devDependencies zusätzlich: `vitest`, `@biomejs/biome`, `@rollup/plugin-replace`, `tsx`.
  - Die Rollup-Config liest `process.env.ONAIR_DEV`. Gesetzt bedeutet: Output `build/fail.marc.onairclock.dev.sdPlugin/bin/plugin.js` und `__PLUGIN_UUID__ = "fail.marc.onairclock.dev"`. Sonst Output `fail.marc.onairclock.sdPlugin/bin/plugin.js` und `"fail.marc.onairclock"`.
- [ ] **Step 3: Failing test `scripts/dev-manifest.test.ts`.**

```ts
import { toDevManifest } from "./dev-manifest.mjs";
const prod = { UUID: "fail.marc.onairclock", Name: "On Air Clock", Actions: [
  { UUID: "fail.marc.onairclock.action" }, { UUID: "fail.marc.onairclock.countdown" } ] };
test("rewrites plugin and action UUIDs and name", () => {
  const dev = toDevManifest(prod);
  expect(dev.UUID).toBe("fail.marc.onairclock.dev");
  expect(dev.Name).toBe("On Air Clock (Dev)");
  expect(dev.Actions.map((a) => a.UUID)).toEqual(["fail.marc.onairclock.dev.action", "fail.marc.onairclock.dev.countdown"]);
  expect(prod.UUID).toBe("fail.marc.onairclock"); // input not mutated
});
```

- [ ] **Step 4:** `npx vitest run scripts/dev-manifest.test.ts`. Erwartet: FAIL, Modul fehlt.
- [ ] **Step 5: Implementieren.**
  - `toDevManifest` erzeugt eine tiefe Kopie und ersetzt das Präfix `fail.marc.onairclock` → `fail.marc.onairclock.dev` in `UUID` und `Actions[].UUID`.
  - `scripts/build-dev.mjs` kopiert `fail.marc.onairclock.sdPlugin/` ohne `bin/` nach `build/fail.marc.onairclock.dev.sdPlugin/`, schreibt das Dev-Manifest und ruft `rollup -c` mit `ONAIR_DEV=1` auf.
  - Das neue Manifest enthält vorerst nur die Uhr-Action und erfüllt die Global Constraints. Die Countdown-Action kommt in Task 10 dazu.
  - `src/plugin.ts` registriert vorerst nichts und ruft `streamDeck.connect()` auf.
- [ ] **Step 6:** Ausführen: `npm test && npm run typecheck && npm run lint && npm run build && npm run build:dev && npx streamdeck validate fail.marc.onairclock.sdPlugin`. Erwartet: alles grün. Validate darf vorerst Warnungen zu fehlenden Bildern melden, keine Fehler.
- [ ] **Step 7: `.github/workflows/ci.yml` anlegen.**
  - Läuft auf `push` und `pull_request`, Runner `ubuntu-latest`, Node 24.
  - Schritte: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx streamdeck validate fail.marc.onairclock.sdPlugin`.
- [ ] **Step 8: Dev-Plugin verlinken.** `npx streamdeck dev` aktiviert den Entwicklermodus. Danach `npx streamdeck link build/fail.marc.onairclock.dev.sdPlugin`. In der Stream-Deck-App erscheint die Kategorie „On Air Clock (Dev)“. Die V1-Kategorie bleibt bestehen.
- [ ] **Step 9: Commit** `chore: scaffold V2 on Elgato SDK 3, add dev variant and CI, remove V1 code`

### Task 2: Hardware-Spike (Wegwerf-Code, Maintainer-Checkpoint)

**Files:**
- Create: `spike/` (eigenes Mini-Plugin `fail.marc.onairclock.spike`, eigene `rollup.config.mjs`). Der Ordner wird am Ende des Tasks gelöscht.
- Create: `docs/superpowers/notes/2026-11-spike-findings.md` (bleibt)

**Interfaces:**
- Produces: das Findings-Dokument mit diesen Werten, die Task 6–9 übernehmen:
  - `DATA_URI_FORMAT`: `"base64"`, `"utf8"` oder `"uri"`
  - `GLOW_TECHNIQUE`: `"radialGradient"` oder `"stackedCircles"`
  - `TEXT_SUPPORTED`: boolean
  - `FAST_FPS`: Zahl
  - `TZ_VANCOUVER_OFFSET_2026_11`: Minuten
  - `process.versions.icu` und `process.versions.tz`

- [ ] **Step 1:** Spike-Action mit 6 Testbildern, ein Tastendruck schaltet weiter:
  1. Radialverlauf-Glow neben gestaffelten halbtransparenten Kreisen
  2. verschachtelte `transform="translate() scale()"` mit `stroke-linecap="round"` (Ziffernpfade aus dem Mockup)
  3. `<g opacity>` und `stroke-opacity`
  4. `<text font-family="sans-serif">NYC</text>`
  5. dasselbe SVG als `data:image/svg+xml;base64,…`, `;charset=utf8,<svg…>` und `,encodeURIComponent(…)`
  6. Animation des Linie-Faces mit 4, 8, 12, 20 und 30 fps
- [ ] **Step 2:** Beim Start loggt der Spike `process.versions.icu`, `process.versions.tz` und den Versatz von `America/Vancouver` am 2026-11-11 über `Intl.DateTimeFormat(…, { timeZone, timeZoneName: "longOffset" })`.
- [ ] **Step 3: Maintainer-Checkpoint.**
  - Der Maintainer legt die Spike-Action 15-mal auf eine Seite des MK.2 und beschreibt pro Testbild, was er sieht.
  - Währenddessen misst `ps -o %cpu,rss -p <Stream-Deck-PID>,<Plugin-PID>` je 30 s pro Bildrate.
  - `FAST_FPS` ist die höchste Rate, bei der der Plugin-Prozess unter 10 % CPU liegt und die App flüssig bleibt. Sie liegt höchstens bei 15 und mindestens bei 4.
- [ ] **Step 4: Findings-Dokument schreiben.**
  - Pro Wert ein Satz Begründung.
  - Ist `TZ_VANCOUVER_OFFSET_2026_11` = −480 (also veraltet): festhalten, dass V2 keine eigenen Zeitzonen-Daten mitliefert. Der feste UTC-Versatz ist die Lösung, und PI und README weisen darauf hin.
  - Ist `TEXT_SUPPORTED` false: Die Beschriftung (Task 7) verwendet stattdessen den nativen Stream-Deck-Titel. Task 7 und 9 lesen diesen Wert.
- [ ] **Step 5:** `rm -rf spike/`. Commit `docs: record hardware spike findings`.

### Task 3: Zeit und Formatierung (`src/core/time.ts`, `src/core/format.ts`)

**Files:**
- Create: `src/core/time.ts`, `src/core/format.ts`, `src/core/time.test.ts`, `src/core/format.test.ts`
- Modify: `vitest.config.ts` (`test.env.TZ = "Europe/Berlin"`)

**Interfaces:**
- Produces:

```ts
export interface WallTime { year: number; month: number; day: number; hour: number; minute: number; second: number; ms: number } // month 1–12, hour 0–23
export type ZoneSetting = { kind: "system" } | { kind: "iana"; zone: string } | { kind: "offset"; minutes: number };
export function wallTime(nowMs: number, zone: ZoneSetting): WallTime;
export function isValidIanaZone(zone: string): boolean;
export const OFFSET_STEPS: readonly number[]; // -720 … 840 in 15er-Schritten (105 Werte)
// format.ts
export type DateFormat = "dd-mm" | "mm-dd" | "dd-mm-yy" | "mm-dd-yy" | "yy-mm-dd";
export function pad2(n: number): string;
export function formatDate(t: WallTime, f: DateFormat): string;
export function displayHour(hour24: number, hour12: boolean): number; // 12h: 0→12, 13→1
export function isPm(hour24: number): boolean;
export function formatMMSS(totalSeconds: number): string; // auf 0…5999 geklemmt, "05:00", "99:59"
export function formatOffset(minutes: number): string; // -420 → "UTC−07:00", 345 → "UTC+05:45"
```

- [ ] **Step 1: Failing tests.**
  - `wallTime(Date.UTC(2026,10,11,12,0,5,250), {kind:"offset",minutes:-420})` → `{hour:5, minute:0, second:5, ms:250, day:11, month:11, year:2026}`
  - iana `Europe/Berlin` bei `Date.UTC(2026,9,25,0,59,59)` → 02:59:59, bei `Date.UTC(2026,9,25,1,0,0)` → 02:00:00
  - `Asia/Kathmandu` bei `Date.UTC(2026,10,11,12,0,0)` → 17:45
  - `{kind:"system"}` entspricht den `new Date(ms)`-Gettern
  - `isValidIanaZone("Mars/Phobos") === false`
  - `OFFSET_STEPS.length === 105`
  - `formatDate` für alle 5 Formate mit 2026-11-05 → `"05-11"`, `"11-05"`, `"05-11-26"`, `"11-05-26"`, `"26-11-05"`
  - `displayHour(0,true)===12`, `displayHour(13,true)===1`, `displayHour(13,false)===13`
  - `formatMMSS(6000)==="99:59"`, `formatMMSS(-3)==="00:00"`, `formatOffset(-420)==="UTC−07:00"`
- [ ] **Step 2:** `npx vitest run src/core` → FAIL.
- [ ] **Step 3: Implementieren.**
  - iana über ein gecachtes `Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year…second })` mit `formatToParts`. Millisekunden aus `nowMs % 1000`.
  - offset über die UTC-Getter von `new Date(nowMs + minutes*60000)`.
- [ ] **Step 4:** Tests grün.
- [ ] **Step 5:** Commit `feat(core): wall time per zone and formatting`.

### Task 4: Settings und V1-Migration (`src/core/settings.ts`)

**Files:**
- Create: `src/core/settings.ts`, `src/core/settings.test.ts`

**Interfaces:**
- Consumes: `ZoneSetting`, `DateFormat`, `isValidIanaZone` (Task 3)
- Produces:

```ts
export type FaceId = "classic" | "modern" | "line" | "comet" | "big";
export type EndMode = "overtime" | "hold" | "clock";
export interface ClockConfig {
  face: FaceId; showDate: boolean; showSeconds: boolean; dateFormat: DateFormat; hour12: boolean; pmIndicator: boolean;
  colors: { active: string; inactive: string; background: string };
  zone: ZoneSetting; label: string; animations: boolean; blinkColon: boolean; showCountdown: boolean;
}
export interface CountdownConfig { durationSec: number; endMode: EndMode; warn: boolean; color: string }
/** Gespeicherte Keys (das schreibt der PI). V1-Keys bleiben namensgleich. */
export type ClockSettingsStored = Partial<{
  face: FaceId; showDate: boolean; showSeconds: boolean; dateType: string; hourFormat: string; ampmindicator: boolean | string;
  dotcolor: string; inactivecolor: string; backgroundcolor: string;
  timezone: string; /* "system" | "fixed" | IANA */ utcOffset: string; /* Minuten als String, z. B. "-420" */
  label: string; animations: boolean; blinkColon: boolean; showCountdown: boolean;
}>;
export type CountdownSettingsStored = Partial<{ duration: string; endMode: EndMode; warn: boolean; color: string }>;
export const CLOCK_DEFAULTS: ClockConfig;
export const COUNTDOWN_DEFAULTS: CountdownConfig;
export function migrateV1(raw: Record<string, unknown>): { settings: ClockSettingsStored; changed: boolean };
export function normalizeClock(raw: Record<string, unknown>): ClockConfig;
export function normalizeCountdown(raw: Record<string, unknown>): CountdownConfig;
```

- [ ] **Step 1: Failing tests.**
  - `normalizeClock({})` deep-equals `CLOCK_DEFAULTS`. Erwartet: `face:"classic"`, `showDate:true`, `showSeconds:true`, `dateFormat:"dd-mm"`, `hour12:false`, `pmIndicator:false`, Farben laut Global Constraints, `zone:{kind:"system"}`, `label:""`, `animations`, `blinkColon` und `showCountdown` jeweils true.
  - `migrateV1` als Tabelle:
    - `watchface "0"` → classic, Datum ja, Sekunden ja
    - `"1"` → classic, Datum nein, Sekunden ja
    - `"2"` → classic, Datum ja, Sekunden nein
    - `"3"` → classic, Datum nein, Sekunden nein
    - `"4"` → modern
    - `"7"` → wie `"0"`
  - Dabei gilt jeweils `changed: true`. Der Key `watchface` wird entfernt, ebenso `mynameinput`. `ampmindicator: "true"` wird zu `true`.
  - `migrateV1({face:"line", showDate:false})` → `changed: false`.
  - Sind `face` und `watchface` beide gesetzt, gewinnt `face`, und `watchface` wird entfernt.
  - Kaputte Werte führen zum Default: `dotcolor:"red"`, `hourFormat:12` (Zahl → `hour12: true` wird akzeptiert), `timezone:"Mars/Phobos"`, `utcOffset:"17"` (kein 15er-Schritt), `label:"VERYLONGLABEL"` (gekürzt auf 6 Zeichen, Großbuchstaben).
  - `timezone:"fixed", utcOffset:"-420"` → `{kind:"offset",minutes:-420}`. `timezone:"America/Vancouver"` → iana.
  - `normalizeCountdown({duration:"5"})` → `durationSec` 300 (Default). `"99:59"` → 5999, `"00:00"` → Default, `"7:30"` → 450.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implementieren.** Farben über die V1-Regex `^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$`. Alles andere als Whitelist-Prüfung mit Fallback auf den Default.
- [ ] **Step 4:** Grün.
- [ ] **Step 5:** Commit `feat(core): settings normalization and V1 migration`.

### Task 5: Countdown-Zustand (`src/core/countdown.ts`)

**Files:**
- Create: `src/core/countdown.ts`, `src/core/countdown.test.ts`

**Interfaces:**
- Consumes: `CountdownConfig`, `EndMode` (Task 4)
- Produces:

```ts
export interface Countdown { deviceId: string; sourceActionId: string; startMs: number; durationMs: number; endMode: EndMode; warn: boolean }
export type CountdownView =
  | { phase: "running"; remainingMs: number; fraction: number; warn: boolean } // fraction 1 → 0
  | { phase: "overtime"; overMs: number }
  | { phase: "hold"; sinceZeroMs: number }
  | { phase: "flash"; sinceZeroMs: number } // endMode "clock", 0 … 2000 ms
  | { phase: "finished" };
export const FLASH_MS = 2000;
export function viewCountdown(c: Countdown, nowMs: number): CountdownView;
export function countdownDigits(v: CountdownView): string; // running: ceil(s), overtime: "+"+floor(s), hold/flash: "00:00"
export class CountdownRegistry {
  press(deviceId: string, actionId: string, cfg: CountdownConfig, nowMs: number): "started" | "cancelled";
  cancel(deviceId: string): boolean;
  get(deviceId: string, nowMs: number): Countdown | undefined; // entfernt beendete ("finished") Einträge
}
```

- [ ] **Step 1: Failing tests** (Dauer 5000 ms, Start bei t0):
  - t0 → running mit `remainingMs` 5000 und `fraction` 1, digits `"00:05"`
  - t0+4001 → digits `"00:01"`
  - t0+5000 bei overtime → `overMs` 0, digits `"+00:00"`; t0+6500 → `"+00:01"`
  - hold bei t0+9000 → phase hold
  - clock bei t0+6000 → flash, `sinceZeroMs` 1000; bei t0+7000 → finished, und `registry.get` liefert `undefined`
  - `warn` ist nur bei `remainingMs ≤ 10000` und `cfg.warn` true
  - `press` mit derselben Action zweimal → `"started"`, dann `"cancelled"`
  - eine andere Action auf demselben Gerät → `"started"` und ersetzt (`sourceActionId` neu)
  - Countdowns auf Gerät A und B sind unabhängig
  - `get` nach „Seitenwechsel“ (kein Aufruf dazwischen) liefert die korrekte Restzeit
  - eine Systemuhr, die zurückspringt (`nowMs < startMs`), gilt als `remainingMs = durationMs`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Grün.
- [ ] **Step 5:** Commit `feat(core): countdown state and per-device registry`.

### Task 6: Ziffern und Geometrie (`src/render/digits.ts`, `src/render/geometry.ts`, `src/render/svg.ts`)

**Files:**
- Create: `src/render/digits.ts`, `src/render/geometry.ts`, `src/render/svg.ts` sowie die Tests `src/render/digits.test.ts` und `src/render/geometry.test.ts`

**Interfaces:**
- Produces:

```ts
// geometry.ts – Koordinatenraum 144×144, Mittelpunkt (72,72), Bruchteil 0 = 12 Uhr, im Uhrzeigersinn
export function polar(r: number, frac: number): [number, number];
export function arcPath(r: number, f0: number, f1: number): string; // "" wenn f1-f0 ≤ 0.0005, Vollkreis ab ≥ 0.9995
// digits.ts – Glyphen 10×16 Einheiten aus Mockup `G`, Spaltbreiten `GW`, Abstand 3.4
export const GLYPHS: Readonly<Record<string, string>>;
export interface DigitOptions { cx: number; cy: number; height: number; stroke: number; color: string; prev?: string; progress?: number; colonOpacity?: number }
export function renderDigits(text: string, o: DigitOptions): string; // <g>…</g>, unbekannte Zeichen werden übersprungen
// svg.ts
export function svgDocument(inner: string, background: string): string; // <svg xmlns viewBox="0 0 144 144">…
export function toDataUri(svg: string): string; // Format laut Findings DATA_URI_FORMAT
```

- [ ] **Step 1: Failing tests.**
  - `polar(50,0)` ≈ `[72,22]`, `polar(50,0.25)` ≈ `[122,72]`
  - `arcPath(61,0,0)===""`. `arcPath(61,0,1)` enthält zwei `A`-Befehle. `arcPath(61,0,0.75)` hat das Large-Arc-Flag 1.
  - `renderDigits("12:34",…)` enthält 4 `<path` und 2 `<circle`
  - mit `prev:"12:33", progress:0.5` → 5 `<path`
  - mit `progress:1` → 4
  - `"A1"` → 1 `<path`
  - `colonOpacity:0.2` erscheint als `opacity="0.2"`
  - `toDataUri` beginnt mit dem Präfix laut Findings
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementieren.** Glyphenpfade, Abstand und das Roll-Verhalten (Verschiebung ±9 Einheiten, Ease-Out-Kubik) aus dem Mockup übernehmen: Funktionen `digits`, `G`, `GW`.
- [ ] **Step 4:** Grün.
- [ ] **Step 5:** Commit `feat(render): monoline digits, geometry, svg helpers`.

### Task 7: Face-Modell und die fünf Faces

**Files:**
- Create: `src/core/clock-model.ts`, `src/render/faces/{classic,modern,line,comet,big,index}.ts`, `src/render/countdown-key.ts` sowie die Tests `src/core/clock-model.test.ts` und `src/render/faces/faces.test.ts`

**Interfaces:**
- Consumes: Task 3 bis 6
- Produces:

```ts
// clock-model.ts
export interface FaceModel {
  mode: "clock" | "countdown";
  main: string; prevMain: string; mainAgeMs: number;      // "16:59" bzw. Countdown-Ziffern; Alter seit letztem Wechsel
  sub?: string; prevSub?: string; subAgeMs: number;        // Sekunden (nur Uhr, nur bei showSeconds)
  date?: string; label?: string; pm: boolean;
  fraction: number;    // Uhr: (s+ms/1000)/60; Countdown running: Restanteil; sonst 0
  step: number;        // aktive Punkte 0–60 (Uhr: s+1; Countdown: ceil(fraction*60))
  secAgeMs: number; minuteAgeMs: number;
  countdown?: CountdownView;
}
export function buildFaceModel(nowMs: number, cfg: ClockConfig, cd?: { countdown: Countdown; view: CountdownView }): FaceModel;
// faces/index.ts
export interface FaceStyle { active: string; inactive: string; background: string }
export interface AnimState { roll: number; wipe: number; glow: number; colonOpacity: number; pulse: number; ringOn: boolean; flash: boolean } // Task 8 füllt das; neutral = STATIC_ANIM
export const STATIC_ANIM: AnimState; // roll 1, wipe 1, glow 0, colonOpacity 1, pulse 1, ringOn true, flash false
export function renderFace(face: FaceId, m: FaceModel, s: FaceStyle, a: AnimState): string; // vollständiges <svg>
// countdown-key.ts
export function renderCountdownKey(view: CountdownView | null, durationSec: number, color: string): string;
```

- [ ] **Step 1: Failing tests `clock-model.test.ts`** (TZ Europe/Berlin, `nowMs` = 2026-11-11 16:59:53.250 lokal):
  - `main "16:59"`, `prevMain "16:58"`, `sub "53"`, `step 54`, `date "11-11"`, `minuteAgeMs 53250`, `subAgeMs 250`
  - 12h mit `pmIndicator` → `main "04:59"`, `pm true`
  - `showSeconds:false` → `sub` undefined
  - mit running-Countdown (Rest 4200 von 5000 ms) → `mode "countdown"`, `main "00:05"`, `fraction 0.84`, `step 51`, `sub` und `date` undefined
  - bei `cfg.showCountdown === false` wird `cd` ignoriert, dann gilt `mode "clock"`
- [ ] **Step 2: Failing tests `faces.test.ts`** (strukturell, mit `STATIC_ANIM`):
  - classic bei `step 54` → genau 54 Kreise mit `fill="<active>"` im Punktring plus 12 Stundenmarken
  - jedes Face liefert ein gültiges `<svg viewBox="0 0 144 144"`
  - jedes Face rendert im Countdown-Modus und in jeder Phase ohne Fehler (Matrix 5 Faces × 5 Phasen)
  - line bei `fraction 0` → kein Bogen-`<path` außer dem Hintergrundring
  - classic mit Label „NYC“: Ist `TEXT_SUPPORTED`, ersetzt es die Datumszeile. Sonst erscheint kein Label im SVG.
  - big zeigt `main` aufgeteilt in zwei Zeilen
  - zusätzlich je Face ein Snapshot (`toMatchSnapshot`) für Uhr- und Countdown-Modus
- [ ] **Step 3:** FAIL.
- [ ] **Step 4: Implementieren.**
  - Geometrie und Werte für classic, line, comet und big aus Mockup `render()`, die Countdown-Darstellung ebenso. Der Ring zeigt `fraction`. Im Überziehen und beim Halten blinkt er über `a.ringOn`.
  - modern nach V1 `app.js` `drawModernTime` mit Punktring:
    - Stunden bei `cy 50` mit Höhe 30
    - Minuten bei `cy 88` mit Höhe 30
    - Sekunden bei `cy 118` mit Höhe 13
  - Optionen je Face:
    - classic: Datum und Sekunden gemäß `showDate` und `showSeconds`
    - modern und line: Sekunden gemäß `showSeconds`, kein Datum
    - comet und big: nur Stunden und Minuten, die Sekunden zeigt allein der Ring bzw. die Linie
  - Das Label (falls `TEXT_SUPPORTED`) ist `<text>` in Großbuchstaben, `font-family="Barlow, Arial, sans-serif"`. Es erscheint nur in classic, modern und line, jeweils an der Datumsposition, und ersetzt dann das Datum.
  - `renderCountdownKey`:
    - Ruhezustand: Dauer als Ziffern (Höhe 26, `cy 64`) und ein kleines Dreieck darunter
    - aktiv: wie das Line-Face im Countdown-Modus
  - **Achtung:** Im Mockup enthält der Classic-Wipe-Code einen toten Ausdruck `&& false`. Nicht übernehmen.
- [ ] **Step 5:** Grün. Mit `npx vitest run -u` die Snapshots initial anlegen und visuell prüfen: Die Snapshots als SVG-Dateien nach `build/preview/` schreiben (Test-Helper) und im Browser ansehen.
- [ ] **Step 6:** Commit `feat(render): face model and five watchfaces`.

### Task 8: Animationen und Frame-Planung (`src/render/animation.ts`)

**Files:**
- Create: `src/render/animation.ts`, `src/render/animation.test.ts`

**Interfaces:**
- Consumes: `FaceModel`, `AnimState`, `ClockConfig`
- Produces:

```ts
export const ROLL_MS = 380, WIPE_MS = 750, GLOW_MS = 600, BLINK_MS = 500, WARN_LAST_MS = 10000;
export function animState(m: FaceModel, cfg: Pick<ClockConfig, "animations" | "blinkColon">): AnimState;
export function isAnimating(a: AnimState): boolean; // true, solange roll<1, wipe<1, glow>0 oder pulse≠1
export function planNextFrame(nowMs: number, phasesMs: number[], fast: boolean, fastFps: number): number; // Delay in ms
```

- [ ] **Step 1: Failing tests.**
  - `animations:false` → `roll 1`, `wipe 1`, `glow 0`
  - `mainAgeMs 190` → `roll ≈ 0.5`
  - `minuteAgeMs 375` im Uhr-Modus → `wipe 0.5`. Im Countdown-Modus gilt immer `wipe 1`.
  - `secAgeMs 300` → `glow 0.5`
  - `blinkColon` mit `secAgeMs 499` → `colonOpacity 1`, mit `600` → `0.2`. Im Countdown-Modus immer 1.
  - running mit `warn` und `remainingMs 9000` → `pulse` im Bereich [0.6, 1]. Ohne `warn` → 1.
  - overtime mit `secAgeMs 600` → `ringOn false`
  - flash mit `sinceZeroMs < 180` (gerechnet modulo 1000) → `flash true`
  - `planNextFrame(1000.0, [0], false, 12)` → 1000 (nächste Sekundengrenze, plus 5 ms Sicherheitsabstand erlaubt, also im Bereich [1000, 1010])
  - `planNextFrame(1250, [0, 500], false, 12)` → ~250
  - Phase 730 (Countdown-Start) bei `now 1000` → ~730
  - `fast` → `round(1000/12)`
  - Rückwärtssprung (`nowMs` negativ oder kleiner als zuvor) → Ergebnis immer in [10, 1010]
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren. Ease-Out-Kubik für `roll` und `wipe` wie im Mockup.
- [ ] **Step 4:** Grün.
- [ ] **Step 5:** Commit `feat(render): animation state and frame planning`.

### Task 9: Takt und Uhr-Action, Property Inspector, Stream Deck+

**Files:**
- Create: `src/plugin/ticker.ts`, `src/plugin/clock-controller.ts`, `src/plugin/clock-action.ts`, `src/plugin/registry.ts`, `fail.marc.onairclock.sdPlugin/ui/clock.html`, `fail.marc.onairclock.sdPlugin/layouts/clock.json` sowie die Tests `src/plugin/ticker.test.ts` und `src/plugin/clock-controller.test.ts`
- Modify: `src/plugin.ts`, `fail.marc.onairclock.sdPlugin/manifest.json` (Uhr-Action: `PropertyInspectorPath "ui/clock.html"`, Encoder `layout "layouts/clock.json"`, `TriggerDescription` Push/Touch „Cancel countdown“)

**Interfaces:**
- Consumes: Task 3 bis 8
- Produces:

```ts
// registry.ts – einzige Instanz, geteilt von Uhr und Countdown
export const countdowns: CountdownRegistry;
// clock-controller.ts – SDK-frei
export interface ClockTarget { id: string; deviceId: string; kind: "key" | "dial"; draw(dataUri: string): Promise<void> }
export class ClockController {
  constructor(registry: CountdownRegistry);
  add(t: ClockTarget, cfg: ClockConfig): void; update(id: string, cfg: ClockConfig): void; remove(id: string): void;
  press(id: string, nowMs: number): void;             // bricht den Countdown des Geräts ab, falls cfg.showCountdown
  frame(nowMs: number): { fast: boolean; phasesMs: number[] }; // rendert alle, ruft draw nur bei geändertem SVG
}
// ticker.ts
export class Ticker { constructor(frame: (nowMs: number) => { fast: boolean; phasesMs: number[] }, fastFps: number, now?: () => number); start(): void; stop(): void }
```

- [ ] **Step 1: Failing tests `clock-controller.test.ts`** (Fake-Targets mit `draw`-Spy):
  - zwei `frame`-Aufrufe zur selben Millisekunde → `draw` genau einmal pro Target
  - 15 Targets → 15 `draw` beim ersten Frame, 0 beim identischen zweiten
  - `update` mit neuem Face → erneuter `draw`
  - bei laufendem Countdown auf Gerät A zeigt ein Target auf A mit `showCountdown` den Countdown, eins mit `showCountdown:false` die Uhrzeit, ein Target auf Gerät B die Uhrzeit
  - `press` auf A beendet den Countdown von A
  - `phasesMs` enthält `startMs % 1000` aktiver Countdowns und 500, wenn ein sichtbares Target `blinkColon` hat
  - Face-Wechsel während eines laufenden Countdowns → nächster Frame zeigt das neue Face im Countdown-Modus, ohne Fehler
- [ ] **Step 2: Failing tests `ticker.test.ts`** (`vi.useFakeTimers`):
  - `frame` wird an Sekundengrenzen aufgerufen
  - `fast: true` → Abstand `1000/fastFps`
  - `stop` → keine weiteren Aufrufe
  - die Fake-Uhr springt um +3 h und −10 min → der Ticker läuft weiter mit Delays in [10, 1010]
- [ ] **Step 3:** FAIL.
- [ ] **Step 4: Implementieren.**
  - `ClockController` hält `Map<id, {target, cfg, lastSvg}>`. `frame` baut für jedes Target das Modell (`buildFaceModel` mit `registry.get(deviceId)`), `animState`, `renderFace` und `toDataUri`.
  - `Ticker` plant mit `planNextFrame` und `setTimeout`.
  - `clock-action.ts` ist eine `@action({ UUID: CLOCK_UUID })`-Klasse und erweitert `SingletonAction<ClockSettingsStored>`:
    - `onWillAppear`: `migrateV1`, bei `changed` → `ev.action.setSettings`. Danach `controller.add` mit `kind = ev.action.isKey() ? "key" : "dial"`. Dabei ruft `draw` `setImage(uri)` (Taste) bzw. `setFeedback({ icon: uri })` (Encoder) auf.
    - `onWillDisappear` → `remove`
    - `onDidReceiveSettings` → `update`
    - `onKeyDown`, `onDialDown`, `onTouchTap` → `press`
    - Der Ticker startet in `src/plugin.ts` nach `connect()`.
    - `FAST_FPS` aus den Findings.
  - `layouts/clock.json`: id `fail.marc.onairclock.layout.clock`, ein Item `{ key: "icon", type: "pixmap", rect: [50, 0, 100, 100] }` (wie V1).
  - `ui/clock.html` mit `sdpi-components` v4, Settings-Keys exakt wie `ClockSettingsStored`, Defaults wie `CLOCK_DEFAULTS`:
    - face (5 Optionen)
    - showDate, showSeconds
    - dateType, hourFormat, ampmindicator
    - drei Farben
    - timezone: Select „System time“, „Fixed UTC offset“ und IANA-Liste per `Intl.supportedValuesOf("timeZone")` im PI
    - utcOffset: Select aus `OFFSET_STEPS` mit `formatOffset`. Wird per kleinem Inline-Script nur bei „fixed“ angezeigt.
    - label: maxlength 6
    - animations, blinkColon, showCountdown
    - Hinweis unter timezone: „Time wrong after a time zone change? Choose a fixed UTC offset.“
- [ ] **Step 5:** Grün. Dann `npm run build:dev && npx streamdeck restart fail.marc.onairclock.dev`.
- [ ] **Step 6: Maintainer-Checkpoint am MK.2.**
  - Alle 5 Faces anlegen, Optionen durchschalten, Zeitzone NYC und festen Versatz −07:00 setzen.
  - 15 Uhren auf eine Seite legen und CPU wie in Task 2 messen. Bedingung: unter 10 %.
  - Abweichungen als Fix im selben Task beheben.
- [ ] **Step 7:** Commit `feat(plugin): shared ticker, clock action, property inspector, SD+ layout`.

### Task 10: Countdown-Action

**Files:**
- Create: `src/plugin/countdown-controller.ts`, `src/plugin/countdown-action.ts`, `src/plugin/countdown-controller.test.ts`, `fail.marc.onairclock.sdPlugin/ui/countdown.html`
- Modify: `src/plugin.ts` (Registrierung, Frames beider Controller zusammenführen: `fast = a.fast || b.fast`, Phasen vereinigt), `manifest.json` (zweite Action `COUNTDOWN_UUID`, `Controllers ["Keypad"]`, `PropertyInspectorPath "ui/countdown.html"`)

**Interfaces:**
- Consumes: `countdowns` (Task 9), `renderCountdownKey` (Task 7), `normalizeCountdown` (Task 4)
- Produces:

```ts
export interface CountdownTarget { id: string; deviceId: string; draw(dataUri: string): Promise<void> }
export class CountdownController {
  constructor(registry: CountdownRegistry);
  add(t: CountdownTarget, cfg: CountdownConfig): void; update(id: string, cfg: CountdownConfig): void; remove(id: string): void;
  press(id: string, nowMs: number): "started" | "cancelled";
  frame(nowMs: number): { fast: boolean; phasesMs: number[] };
}
```

- [ ] **Step 1: Failing tests:**
  - `press` startet den Countdown für das Gerät der Taste. Ein zweiter `press` bricht ab.
  - Eine zweite Countdown-Taste auf demselben Gerät ersetzt den ersten Countdown. Die erste Taste zeigt danach wieder ihren Ruhezustand.
  - `remove` der startenden Taste (Seitenwechsel) beendet den Countdown nicht.
  - Im Ruhezustand zeigt die Taste die Dauer, aktiv die Restzeit. `draw` wird nur bei Änderung aufgerufen.
  - `fast` ist true, solange ein laufender Countdown mit `warn` in den letzten 10 s ist.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementieren.**
  - `countdown-action.ts`: `@action({ UUID: COUNTDOWN_UUID })`, `onKeyDown` → `controller.press`.
  - `ui/countdown.html`:
    - duration: Textfeld, Pattern `^\d{1,2}:[0-5]\d$`, Default `"05:00"`
    - endMode: Select „Count overtime“ (Default), „Hold at 00:00“ und „Back to clock“
    - warn: Checkbox, Default aus
    - color: Default `#FF3B2F`
- [ ] **Step 4:** Grün, Dev-Build, Restart.
- [ ] **Step 5: Maintainer-Checkpoint am MK.2.**
  - Countdown 00:15 mit allen drei Endmodi.
  - Seitenwechsel während des Laufs.
  - Uhr mit „Countdown anzeigen“ aus.
  - Abbruch per Uhr-Taste.
- [ ] **Step 6:** Commit `feat(plugin): countdown action`.

### Task 11: Texte, Lokalisierung, Manifest final

**Files:**
- Create/Modify: `fail.marc.onairclock.sdPlugin/en.json`, `fail.marc.onairclock.sdPlugin/de.json`, `manifest.json` (Name „On Air Clock“, Category „On Air Clock“, Description EN, Tooltips, `URL`, `Author "Marc Herrmann"`)

**Interfaces:**
- Consumes: Manifest aus Task 9 und 10

- [ ] **Step 1: Texte festlegen.**
  - Description EN: „A broadcast studio clock for your Stream Deck: five watchfaces, any color, time zones and a countdown.“
  - Description DE: „Eine Rundfunk-Studiouhr für dein Stream Deck: fünf Ziffernblätter, jede Farbe, Zeitzonen und ein Countdown.“
  - Action-Namen: „On Air Clock“ und „Countdown“
  - Tooltips EN: „A studio clock with time zones.“ und „Starts a countdown on the clocks of this Stream Deck.“, DE sinngemäß
- [ ] **Step 2: PI-Texte.** Prüfen, ob sdpi-components v4 die Lokalisierung über die Plugin-Locale-Dateien unterstützt (Doku sdpi-components.dev). Falls ja, Labels in `en.json` und `de.json` unter `Localization`. Falls nein, bleiben die PI-Labels englisch, und das wird im Findings-Dokument notiert.
- [ ] **Step 3:** `npx streamdeck validate fail.marc.onairclock.sdPlugin` → keine Fehler.
- [ ] **Step 4:** Commit `feat: localized texts and final manifest`.

### Task 12: Migrationstest auf echter Installation (Maintainer-Checkpoint)

**Files:**
- Create: `docs/release/migration-test.md` (Protokoll)

- [ ] **Step 1: Vorbereitung.**
  - Frisches Backup anlegen: `tar czf ~/streamdeck-backup-premigration-$(date +%Y%m%d%H%M).tgz -C ~/Library/Application\ Support com.elgato.StreamDeck`
  - Den Maintainer bitten, alle V1-Uhren zu fotografieren. Zusätzlich sollen Testtasten auf einer eigenen Seite liegen: je eine Uhr mit `watchface 0` bis `4`, eine mit eigenen Farben und eine nie eingestellte.
- [ ] **Step 2: Installieren.**
  - `npm run build && npx streamdeck pack fail.marc.onairclock.sdPlugin --output build/`
  - `open build/fail.marc.onairclock.streamDeckPlugin`
  - Die App installiert über V1 wie bei einem echten Update.
- [ ] **Step 3: Prüfen.**
  - Jede Testtaste zeigt das erwartete Face und die erwarteten Farben. Die nie eingestellte Uhr zeigt die neuen Defaults.
  - Der PI zeigt die migrierten Werte, `watchface` ist aus den Settings verschwunden.
  - Das Ergebnis kommt in `docs/release/migration-test.md`.
- [ ] **Step 4: Rollback bei Fehlschlag.**
  - Stream Deck beenden, das Backup zurückspielen.
  - V1 per `gh release download 1.3.0 -p '*.streamDeckPlugin' -D build/v1` und `open` neu installieren.
  - Den Fehler in Task 4 oder 9 beheben und Task 12 wiederholen.
- [ ] **Step 5:** Commit `docs: record V1→V2 migration test`.

### Task 13: Branding-Assets („Farbraum“)

**Files:**
- Create:
  - `assets/fonts/` (Unbounded und Barlow TTF aus dem google/fonts-Repo plus `OFL.txt`)
  - `assets/brand/*.svg` (handgezeichnete Quellen)
  - `scripts/build-assets.ts`, `scripts/build-assets.test.ts`
  - Ausgaben:
    - Plugin-Icons: `fail.marc.onairclock.sdPlugin/imgs/plugin/{icon.png,icon@2x.png,category.svg}`
    - Uhr-Action: `imgs/actions/clock/{icon.svg,key.png,key@2x.png,encoder.png,encoder@2x.png}`
    - Countdown-Action: `imgs/actions/countdown/{icon.svg,key.png,key@2x.png}`
    - Marketing: `marketing/{marketplace-icon.png,gallery-1-hero.png,gallery-2-faces.png,gallery-3-timezones.png,gallery-4-countdown.png,social-preview.png}`
    - README: `docs/images/{readme-hero.png,readme-demo.gif}`
- Delete: `fail.marc.onairclock.sdPlugin/action/`, `fail.marc.onairclock.sdPlugin/previews/`, `pi.png`, `preview.gif`
- Modify: `manifest.json` (Pfade `Icon "imgs/plugin/icon"`, `CategoryIcon "imgs/plugin/category"`, Action-Icons und State-Images)

**Interfaces:**
- Consumes: `renderFace`, `renderCountdownKey`, `buildFaceModel` (Tasks 7 und 8), Rasterung über `@resvg/resvg-js` (`fontFiles` aus `assets/fonts`), GIF über `gifenc`
- Produces: `npm run assets` erzeugt alle Ausgaben deterministisch aus einer festen Zeit (10:08:30, 2026-11-11).

- [ ] **Step 1: Failing test `build-assets.test.ts`.** Nach `buildAssets(outDir)` hat jede Ausgabedatei die exakte Größe laut Global Constraints:
  - PNG-Header: `icon.png` 256, `icon@2x.png` 512, `marketplace-icon.png` 288, `gallery-*.png` 1920×960, `social-preview.png` 1280×640, `key.png` 72, `key@2x.png` 144
  - Die SVG-Icons enthalten nur `#FFFFFF` bzw. `white` als Farbe.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: Implementieren.** Motive:
  1. **Hero:** Ultramarin-Fläche, links „On Air Clock“ (Unbounded 700) und darunter der Claim EN (Barlow). Rechts ein 4×3-Raster echter Tasten mit Uhren in verschiedenen Farben und Faces, ohne große 2×2-Uhr.
  2. **Faces:** fünf Tasten in einer Reihe mit Namen. Überschrift „Five watchfaces“.
  3. **Zeitzonen:** fünf Weltzeituhren mit Labels BER, NYC, TYO, LON, SYD. Überschrift „World clocks with time zones“.
  4. **Countdown:** drei Tasten 05:00, 00:10 und +00:12 mit der Überschrift „Countdown with overtime“.
  - Plugin-Icon und Marketplace-Icon: schwarze Taste auf Ultramarin mit dreifarbigem Ring wie im Mockup `iconSvg("c")`.
  - Kategorie- und Action-Icons: weiße Outline-Symbole (Uhr-Ring mit Punkt bzw. Ring mit Dreieck).
  - README-GIF: drei Sekunden um einen Minutenwechsel, 12 fps, Faces classic, line, comet und big nebeneinander.
- [ ] **Step 4:** Grün, und `npx streamdeck validate` ohne Bildfehler.
- [ ] **Step 5: Maintainer-Checkpoint.** Die Galeriebilder und Icons dem Maintainer zeigen und Feedback einarbeiten.
- [ ] **Step 6:** Commit `feat(brand): Farbraum assets, icons and marketplace gallery`.

### Task 14: README, Release-Texte, Checklisten

**Files:**
- Modify: `README.md` (komplett neu, EN)
- Create:
  - Release-Texte: `CHANGELOG.md`, `docs/release/marketplace-listing.md`, `docs/release/issue-comments.md`
  - Test-Checklisten: `docs/release/checklist-sdplus.md`, `docs/release/checklist-windows.md`

- [ ] **Step 1: `README.md`.** Abschnitte:
  - Hero-Bild, Claim, GIF
  - Features: Faces, Farben, Zeitzonen und UTC-Versatz, Countdown mit drei Endmodi
  - Installation (Marketplace, GitHub Release, Stream Deck ≥ 7.1)
  - „Wrong time?“ mit Hinweis auf den festen UTC-Versatz und dem Befund aus dem Spike
  - Entwicklung: `npm i`, `npm run build:dev`, `npx streamdeck link …`, `npm test`
  - Lizenz MIT, Danksagung wie V1
  - Kein Wort zu mehreren Tasten.
- [ ] **Step 2: Release-Texte.**
  - `marketplace-listing.md`: Name, Claim, Kurz- und Langbeschreibung EN und DE, 3 bis 5 Tags, Liste der Galeriebilder
  - `CHANGELOG.md` mit dem Eintrag 2.0.0
  - `issue-comments.md`: Entwürfe für #2, #7 und #10 (gelöst in 2.0.0, mit Erklärung) und für #5 (nicht umgesetzt, mit Begründung). Gepostet wird erst nach Freigabe.
- [ ] **Step 3: Checklisten.** Je Gerät und Betriebssystem 10 bis 15 abhakbare Prüfpunkte:
  - Faces, Optionen, Zeitzone und Versatz
  - Countdown in allen Endmodi
  - Stream Deck+: Touch-Display und Druck bricht ab
  - Migration von V1
- [ ] **Step 4:** Commit `docs: V2 README, release texts and test checklists`.

### Task 15: Release-Packaging

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: `release.yml` anlegen.**
  - Trigger `push` auf Tags `v*`, Runner `ubuntu-latest`, Node 24.
  - Schritte: `npm ci`, `npm test`, `npm run build`, `npx streamdeck pack fail.marc.onairclock.sdPlugin --output dist/`, dann `gh release create "$GITHUB_REF_NAME" dist/*.streamDeckPlugin --draft --notes-file CHANGELOG.md` mit `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` und `permissions: contents: write`.
- [ ] **Step 2: Lokal dieselben Befehle ausführen.** `npm ci && npm test && npm run build && npx streamdeck pack fail.marc.onairclock.sdPlugin --output build/release/` → genau eine `.streamDeckPlugin`-Datei.
- [ ] **Step 3:** Commit `ci: release workflow`.
- [ ] **Step 4: Dem Maintainer übergeben.** Nächste Schritte, jeweils erst nach seiner Freigabe:
  - Branch pushen
  - PR `v2` → `main`
  - Stream Deck+ und Windows anhand der Checklisten testen
  - Tag `v2.0.0`
  - Marketplace-Einreichung über die Maker Console mit Texten und Bildern aus Task 13 und 14
  - Issue-Kommentare posten
