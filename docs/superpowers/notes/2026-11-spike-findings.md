# Hardware spike findings (Task 2)

**Status: PROVISIONAL.** The maintainer was not at the device and Stream Deck is still 6.8.1 (SDK 3 plugins need 7.1 or newer), so the spike could not run on hardware. The values below are educated defaults. Each must be confirmed in the hardware session. They live in `src/hardware.ts`.

## Provisional values

| Constant | Value | Rationale | Status |
|---|---|---|---|
| `DATA_URI_FORMAT` | `"base64"` | Most widely accepted form for `setImage` with SVG, and what the Elgato docs use. | to be confirmed in hardware session |
| `GLOW_TECHNIQUE` | `"stackedCircles"` | Plain translucent circles are the safest feature set for the key renderer; `radialGradient` support is unverified. | to be confirmed in hardware session |
| `TEXT_SUPPORTED` | `true` | `<text font-family="sans-serif">` is basic SVG and expected to work; if not, Task 7 falls back to the native title. | to be confirmed in hardware session |
| `FAST_FPS` | `10` | Middle of the allowed range [4, 15]; a typical conservative rate for per-frame `setImage` on a USB deck. | to be confirmed in hardware session |

`TZ_VANCOUVER_OFFSET_2026_11` is not provisional here: see the proxy facts below, and re-read it from the Stream Deck runtime in the hardware session.

## Spike plugin

Location: `spike/fail.marc.onairclock.spike.sdPlugin` (UUID `fail.marc.onairclock.spike`, source `spike/plugin.ts`). Build with `npx rollup -c spike/rollup.config.mjs`. The spike must stay in the repo until the session is done; then `rm -rf spike/` and commit `docs: record hardware spike findings`.

Placeholder icons are committed under `imgs/`; `npx streamdeck validate spike/fail.marc.onairclock.spike.sdPlugin` passes with no errors.

On startup the plugin writes the facts (ICU, tz data, Vancouver offset) to the SDK log and to `spike/fail.marc.onairclock.spike.sdPlugin/logs/spike-facts.json`. Each key press and each 10 s of animation append to `logs/spike-steps.log` in the same folder.

## Hardware-session procedure

1. Update Stream Deck to 7.1 or newer.
2. Run `npx rollup -c spike/rollup.config.mjs`.
3. Link the plugin: `npx streamdeck link spike/fail.marc.onairclock.spike.sdPlugin` (or `npx streamdeck dev` first on older CLI setups), then `npx streamdeck restart fail.marc.onairclock.spike`.
4. Place the "Spike" action (category "On Air Clock Spike") on 15 keys of one MK.2 page.
5. Read `logs/spike-facts.json` and copy the real `icu`, `tz` and `vancouverOffset_2026_11_11` into this document (replacing the proxy facts for decisions).
6. Press a key to cycle. Steps, in order (the key shows step 1 on appear):
   1. Glow: radialGradient on the LEFT, stacked translucent circles on the RIGHT. Does the left glow render as a soft fade (not a hard disc or nothing)? Do the right circles look like a smooth glow?
   2. Digits `12:34` and `56` from nested `translate() scale()` with round linecaps. Are strokes crisp, round-capped, correctly placed?
   3. `<g opacity=".4">` shapes (top) and `stroke-opacity` ring/line (bottom). Are they dimmed as expected?
   4. Text "NYC" (red) and "Vancouver" (white) in `sans-serif`. Is text rendered at all, and legibly?
   5a. Line face as `data:image/svg+xml;base64,...`
   5b. same as `data:image/svg+xml;charset=utf8,<svg...>` (raw)
   5c. same as `data:image/svg+xml,` + `encodeURIComponent(...)`. Which of 5a/5b/5c render? Identical?
   6. Animated line face at 4, 8, 12, 20, 30 fps (one further press per rate; each press stops the previous animation). The current fps is shown as a small white number at the bottom of the key.
7. Per image, note what is seen (OK / wrong / blank).
8. CPU measurement, 30 s per rate. IMPORTANT: the real use case is many animated keys, so measure with ALL 15 keys animating at the same fps. Each key advances independently, so press every one of the 15 keys until each shows the same fps number (the white number at the bottom), and only then start the 30 s measurement. Measuring a single key would understate CPU roughly 15x and give a too-high FAST_FPS. Find PIDs: `pgrep -fl "Stream Deck"` and `pgrep -fl fail.marc.onairclock.spike` (the plugin appears as a node process with the plugin path; its PID is also written in `logs/spike-steps.log`). For each fps step, once all 15 keys show the same fps step:
   ```sh
   for i in $(seq 1 6); do ps -o %cpu,rss -p <STREAMDECK_PID>,<PLUGIN_PID>; sleep 5; done
   ```
   Record the plugin's average %CPU and whether the Stream Deck UI/keys stay smooth, for 4, 8, 12, 20 and 30 fps.

## Decision rules (verbatim from the brief, Steps 3 and 4)

- `FAST_FPS` is the highest rate at which the plugin process stays below 10 % CPU and the app stays smooth. It is at most 15 and at least 4.
- One sentence of rationale per value.
- If `TZ_VANCOUVER_OFFSET_2026_11` = -480 (i.e. outdated): record that V2 ships no timezone data of its own. The fixed UTC offset is the solution, and the PI and README point this out.
- If `TEXT_SUPPORTED` is false: the label (Task 7) uses the native Stream Deck title instead. Tasks 7 and 9 read this value.

Mapping of results to constants: `DATA_URI_FORMAT` = the form from 5a/5b/5c that renders (prefer base64 if several do); `GLOW_TECHNIQUE` = `radialGradient` only if the left glow in test 1 renders well, else `stackedCircles`; `TEXT_SUPPORTED` = test 4 result; `FAST_FPS` = per rule above, clamped to [4, 15]. Update `src/hardware.ts`, remove the PROVISIONAL status here.

## Proxy facts (LOCAL Node, NOT the Stream Deck runtime)

Measured with local Node v24.14.0 on the dev machine. This is only a proxy for the Node 24 bundled with Stream Deck; Stream Deck may ship different ICU/tz data. Replace with the values from `logs/spike-facts.json` in the hardware session.

- `process.versions.icu`: 78.2
- `process.versions.tz`: 2025c
- `America/Vancouver` offset on 2026-11-11 (`Intl.DateTimeFormat`, `timeZoneName: "longOffset"`): `GMT-08:00` = -480 minutes (correct for PST; the date is after the November DST end, so tz data is current here)

## PI localization

Finding: not applied, the property inspectors stay English.

- The sdpi-components v4 docs pages (sdpi-components.dev/docs, /docs/localization) returned 404 when fetched. The only evidence is the shipped bundle https://sdpi-components.dev/releases/v4/sdpi-components.js.
- The bundle supports `__MSG_key__` in `label` attributes and `<option>` text. It resolves them from an internal `locales` object (`<lang>.<key>`, fallback `en`).
- Nothing in the bundle ever assigns `locales`, and it reads neither the plugin's `en.json`/`de.json` nor a `Localization` block. Every lookup therefore returns an empty string and falls back to the raw key text. There is no verified way to feed it the plugin's locale files.
- Keys are split on `.`, so keys containing dots would not work anyway.
- Decision: PI labels remain English. `en.json`/`de.json` carry only manifest texts (Name, Description, Category, action Name/Tooltip). Revisit if a future sdpi-components release documents locale loading.
