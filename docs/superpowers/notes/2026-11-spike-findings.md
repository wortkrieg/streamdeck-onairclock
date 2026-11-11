# Hardware spike findings (Task 2)

**Status: CONFIRMED on hardware, 2026-11-11** (Stream Deck MK.2, firmware 1.01.000, Stream Deck 7.6.1, @elgato/cli 1.10.4, macOS 26.3.1 on Apple silicon). Step 11 (unplug) passed: the MK.2 was off for 6 s, the clocks came back right after plugging in, and the plugin logged no warning. Still open: the time zone change test (step 10, now with the re-detect fix below) and the Stream Deck+ (step 12).

## Results

| Constant | Value | Rationale |
|---|---|---|
| `DATA_URI_FORMAT` | `"base64"` | 5a, 5b and 5c render identically on the key and in the app; base64 is the documented form. |
| `GLOW_TECHNIQUE` | `"radialGradient"` | The gradient renders as a soft fade on the device; the stacked circles show visible rings. |
| `TEXT_SUPPORTED` | `true` | "NYC" and "Vancouver" render sharp and legible in `sans-serif`. |
| `FAST_FPS` | `10` | Used only for the short roll/wipe bursts at the minute change; the 60 s measurements of the real build include these bursts, and even 30 fps sustained on 15 keys stayed smooth. |

Runtime facts from `logs/spike-facts.json` (Stream Deck's own Node, downloaded by the app):

- `node` v24.22.1, `icu` 78.3, `tz` 2026e
- `America/Vancouver` on 2026-11-11: `GMT-07:00` = -420. The runtime's tz data is current, so "System time" and the IANA zone show British Columbia correctly. The fixed UTC offset stays as the documented fallback (README "Wrong time?").

## CPU (15 keys on one MK.2 page, share of one core, cumulative CPU time over the window)

V1 is an HTML plugin and renders inside the app's browser engine (QtWebEngineProcess), so that process group is measured too.

| Configuration | App | Browser engine | Plugin | Total over idle |
|---|---|---|---|---|
| Empty page (idle) | 3.3-3.4 % | 4.2 % | - | - |
| Spike, all keys @ 4 / 8 / 12 / 20 / 30 fps | 24.9 / 46.6 / 52.7 / 53.5 / 85.3 % | - | 1.0-3.1 % | - |
| **V1, 15 clocks, defaults** | 16.9 % | 19.6 % | - | **+28.9 pp** |
| V2 (old sizes, stacked circles), Classic defaults | 23.1 % | - | 2.1 % | - |
| V2 (old sizes), Line / animations off / animations and colon off | 22.4 / 13.1 / 8.3 % | - | 0.9 / 0.8 / 0.4 % | - |
| **V2 final, Classic defaults** | 20.5 % | 4.0 % | 1.2 % | **+18.1 pp** |
| **V2 final, Line defaults** | 17.6 % | 3.7 % | 0.5 % | **+14.2 pp** |
| V2 final, Classic, countdown running | 19.5 % | 4.2 % | 1.2 % | +17.3 pp |

The app's cost is roughly linear in images per second (about 0.35 % of a core per image/s); the plugin itself stays far below 10 %. Keys and app stayed smooth in every configuration, including 30 fps.

**Ruling R18 (replaces the +10 pp rule of R14):** the provisional rule "app within 10 pp of idle with 15 keys" is not met even by V1 (+28.9 pp in total), so it would have forced V2 below the V1 frame rate. The acceptance rule is now: with the same number of keys at defaults, V2's total load (app, browser engine, plugin) must not exceed V1's; the plugin stays below 10 %; keys and app stay smooth. V2 meets it with a clear margin (+18.1 pp and +14.2 pp against +28.9 pp).

## Further findings

- **Node runtime download.** SDK 3 plugins run on a Node.js runtime that Stream Deck downloads on first use from `node-sd.elgato.com` (to `~/Library/Application Support/com.elgato.StreamDeck/NodeJS/`). With all of Stream Deck's network access blocked (Little Snitch here), the download fails silently ("Failed to fetch Node.js manifest: canceled") and no SDK 3 plugin starts, Elgato's own included. V1 (HTML) did not need this. README "Installation" says so.
- **CategoryIcon.** Stream Deck 7.6.1 refuses a plugin with `Category` but no `CategoryIcon` ("category icon not defined"), although `streamdeck validate` passes. The V2 manifest has it; only the spike lacked it.
- **System time zone changes.** Node fixes the local zone at start-up. Deleting `process.env.TZ` makes it re-detect the host zone (checked with Stream Deck's Node 24.22.1: Tokyo -> delete -> Europe/Berlin again). V2 does this every 10 s (`src/plugin/system-zone.ts`, ruling R19), so clocks on "System time" should follow a changed zone within 10 s. Step 10 on hardware is still to be done to confirm it end to end.
- **Legibility (maintainer feedback on the device).** Date, seconds and partly the main digits were too small to read from a distance. All faces were enlarged (ring moved out to r 65/64 like V1's r 66, main digits +20 to +40 %, seconds +55 to +70 %, date +55 %, labels up to +50 %, strokes 15 to 25 % heavier, long strings such as "+00:12" or "11-11-26" shrink to fit). The maintainer confirmed the new sizes on the MK.2.

## Spike plugin

Location: `spike/fail.marc.onairclock.spike.sdPlugin` (UUID `fail.marc.onairclock.spike`, source `spike/plugin.ts`). Build with `npx rollup -c spike/rollup.config.mjs`. The spike must stay in the repo until the session is done; then `rm -rf spike/` and commit `docs: record hardware spike findings`.

Placeholder icons are committed under `imgs/`; `npx streamdeck validate spike/fail.marc.onairclock.spike.sdPlugin` passes with no errors.

On startup the plugin writes the facts (ICU, tz data, Vancouver offset) to the SDK log and to `spike/fail.marc.onairclock.spike.sdPlugin/logs/spike-facts.json`. Each key press and each 10 s of animation append to `logs/spike-steps.log` in the same folder.

Hardware-session helpers (added during the session): one key press switches all spike keys together; `gallery` shows image tests 1 to 7 on keys 1 to 7 at once; the plugin bundles two profiles ("On Air V2 Test": empty page, spike page, 15 clocks per configuration, countdown page, faces page; "On Air V1 Ref": 15 V1 clocks) and switches the MK.2 to them on command. Write one command into `logs/cmd.txt`: `page <0-based index>`, `step <index>`, `gallery`, `v1`, `back`, `devices`.

## Hardware-session procedure

0. Prerequisites: run `npm ci` in the repo, then record the CLI version from `npx streamdeck --version` and the Stream Deck app version (from its About window) in this document.
1. Update Stream Deck to 7.1 or newer.
2. Run `npx rollup -c spike/rollup.config.mjs`.
3. Link the plugin: `npx streamdeck link spike/fail.marc.onairclock.spike.sdPlugin` (or `npx streamdeck dev` first on older CLI setups), then `npx streamdeck restart fail.marc.onairclock.spike`.
4. Place the "Spike" action (category "On Air Clock Spike") on 15 keys of one MK.2 page.
5. Read `logs/spike-facts.json` and copy the real `icu`, `tz` and `vancouverOffset_2026_11_11` into this document (replacing the proxy facts for decisions). This is the America/Vancouver offset as the Stream Deck Node runtime sees it. Per the spec (British Columbia stays on UTC-7), -420 means current tz data and -480 means stale tz data. If it is -420, update the "Observed" sentence in README "Wrong time?"; the fixed UTC offset stays the documented fix either way.
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
   Record the average %CPU of BOTH processes, the Stream Deck app and the plugin, and whether the Stream Deck UI and keys stay smooth, for 4, 8, 12, 20 and 30 fps. The app decodes every image and drives the device, so it can carry a large part of the load. Before the first rate, record the app's baseline the same way with an empty MK.2 page (no plugin keys visible).
9. Measure the real V2 dev build as well, not only the spike:
   1. `npm run build:dev`, then `npx streamdeck link build/fail.marc.onairclock.dev.sdPlugin` and `npx streamdeck restart fail.marc.onairclock.dev`. Remove the spike keys from the page.
   2. Place 15 clocks from the category "On Air Clock (Dev)" on one MK.2 page, all with default settings (Classic). Configure one key and copy and paste it to the others where needed.
   3. Measure both processes as in step 8 for 60 s, so the window includes one full minute (`for i in $(seq 1 12); do ps -o %cpu,rss -p <STREAMDECK_PID>,<PLUGIN_PID>; sleep 5; done`; the plugin PID comes from `pgrep -fl fail.marc.onairclock.dev`).
   4. Repeat with all 15 clocks on Line (defaults otherwise), then with "Animations" off, then with "Animations" and "Blinking colon" off.
   5. Repeat once with a running countdown on all 15 clocks (one Countdown key on another page, started before switching back).
   6. Expected image rates (from `src/plugin/frame-budget.test.ts`, 15 clocks): at defaults 4 images per second per key between minute changes (60 `setImage` per second for the page) and up to 9 in the second of a minute change; 2 per second with animations off; 1 per second with the blinking colon off as well; about 6 per second while a countdown runs on the clocks. V1 drew 4 per second per key.
   7. Record %CPU of both processes and smoothness for each configuration. The acceptance rule below applies to the defaults.
10. Change the macOS time zone while the plugin runs (System Settings > General > Date & Time: turn off "Set time zone automatically using your current location" and pick a zone with a different offset). Does a clock on "System time" follow within a few seconds? If it does not, note it here; README "Wrong time?" then gets "restart Stream Deck after changing the time zone" in a later change. Switch the time zone back afterwards.
11. Unplug the MK.2 for about 10 s and plug it back in while the V2 clocks run. The keys must show the clock again within a second or two, and the plugin log (`build/fail.marc.onairclock.dev.sdPlugin/logs/`) must show no repeating "failed" warnings.
12. Stream Deck+ (in the maintainer's office, together with `docs/release/checklist-sdplus.md`): the dial's touch display shows the clock via `setFeedback` with the base64 SVG data URI (`DATA_URI_FORMAT`), updates every second, and shows a running countdown. If the touch display stays empty while the keys work, note it: the feedback path may need a different data URI format than `setImage`.

## Decision rules (from the brief, Steps 3 and 4; the CPU rule amended by R14 and replaced by R18, see "CPU" above)

- `FAST_FPS` is the highest rate at which, with all 15 keys animating, the plugin process stays below 10 % CPU, the Stream Deck app process stays within 10 percentage points of its baseline (step 8), and the app and keys stay smooth. It is at most 15 and at least 4. The brief measured only the plugin process, which can miss a large part of the load because the app decodes every image.
- The V2 dev build at defaults (step 9, Classic and Line) must meet the same two CPU limits. If it does not, the animations get sparser (lower `FAST_FPS`, shorter phases), as spec section 8 says; they are not switched off.
- One sentence of rationale per value.
- If `TZ_VANCOUVER_OFFSET_2026_11` = -480 (i.e. outdated): record that V2 ships no timezone data of its own. The fixed UTC offset is the solution, and the PI and README point this out.
- If `TEXT_SUPPORTED` is false: the label (Task 7) uses the native Stream Deck title instead. Tasks 7 and 9 read this value.

Mapping of results to constants: `DATA_URI_FORMAT` = the form from 5a/5b/5c that renders (prefer base64 if several do); `GLOW_TECHNIQUE` = `radialGradient` only if the left glow in test 1 renders well, else `stackedCircles`; `TEXT_SUPPORTED` = test 4 result; `FAST_FPS` = per rule above, clamped to [4, 15]. Update `src/hardware.ts`, remove the PROVISIONAL status here.

## Proxy facts (LOCAL Node, NOT the Stream Deck runtime; superseded by "Results")

Measured with local Node v24.14.0 on the dev machine. This is only a proxy for the Node 24 bundled with Stream Deck; Stream Deck may ship different ICU/tz data. Replace with the values from `logs/spike-facts.json` in the hardware session.

- `process.versions.icu`: 78.2
- `process.versions.tz`: 2025c
- `America/Vancouver` offset on 2026-11-11 (`Intl.DateTimeFormat`, `timeZoneName: "longOffset"`): `GMT-08:00` = -480 minutes. Under the spec's premise (section 5.3: British Columbia now stays on UTC-7 permanently) the correct offset is -420, so this tz data is STALE: it still switches Vancouver back to PST in November. This matches README "Wrong time?" and ruling R7: V2 ships no tz data of its own, and the fixed UTC offset is the fix. This is local Node only. Re-read the value from the Stream Deck Node runtime (`logs/spike-facts.json`, step 5) in the hardware session.

## PI localization

Finding: not applied, the property inspectors stay English.

- The sdpi-components v4 docs pages (sdpi-components.dev/docs, /docs/localization) returned 404 when fetched. The only evidence is the shipped bundle https://sdpi-components.dev/releases/v4/sdpi-components.js.
- The bundle supports `__MSG_key__` in `label` attributes and `<option>` text. It resolves them from an internal `locales` object (`<lang>.<key>`, fallback `en`).
- Nothing in the bundle ever assigns `locales`, and it reads neither the plugin's `en.json`/`de.json` nor a `Localization` block. Every lookup therefore returns an empty string and falls back to the raw key text. There is no verified way to feed it the plugin's locale files.
- Keys are split on `.`, so keys containing dots would not work anyway.
- Decision: PI labels remain English. `en.json`/`de.json` carry only manifest texts (Name, Description, Category, action Name/Tooltip). Revisit if a future sdpi-components release documents locale loading.
