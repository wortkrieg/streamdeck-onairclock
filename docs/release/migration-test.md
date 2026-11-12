# Migration test V1 → V2 (Task 12)

Date: 2026-11-12. Stream Deck 7.6.1 on macOS 26.3.1, Stream Deck MK.2. Installed before: On Air Clock 1.3.0 (Marketplace). Installed: `build/fail.marc.onairclock.streamDeckPlugin` 2.0.0.0, packed from branch `v2` with `npx streamdeck pack` and opened like a downloaded update.

Backup before the test: `~/streamdeck-backup-premigration-202611122230.tgz` (whole `com.elgato.StreamDeck` folder). Rollback was not needed.

## Install

The app stopped V1 ("Aborting with reason 'Update plugin'"), reported `installLocal:finished (AllOk)` and started V2 on its Node.js 24 runtime. The installed manifest reads version 2.0.0.0; plugin ID and action ID are unchanged, so every V1 key stayed in place.

## Test page (V1 keys with V1-style settings, as V1 1.3.0 stores them)

| Key | Stored by V1 | Shown by V2 | Stored by V2 after the first appearance |
|---|---|---|---|
| watchface 0 | `{"watchface":"0"}` | Classic, date and seconds | `face: classic, showDate: true, showSeconds: true` |
| watchface 1 | `{"watchface":"1"}` | Classic, no date | `showDate: false, showSeconds: true` |
| watchface 2 | `{"watchface":"2"}` | Classic, no seconds | `showDate: true, showSeconds: false` |
| watchface 3 | `{"watchface":"3"}` | Classic, no date, no seconds | `showDate: false, showSeconds: false` |
| watchface 4 | `{"watchface":"4"}` | Modern Minimal | `face: modern` |
| own colours | dot `#affec5`, inactive `#1a1a1a`, background `#0d0d0d`, watchface 4 | Modern in the same colours | colours kept, `face: modern` |
| 12 h | `ampmindicator:"true"`, `hourFormat:"12"`, `dateType:"mm-dd"`, white | 10:32 with PM dot, date 11-12, white | `ampmindicator: true` (string converted), rest kept |
| light key | white background, dots `#2b3bff`, inactive `#555555`, `yy-mm-dd`, `mynameinput:"TEMPLATE"` | same colours, date 26-11-12 | colours kept, `mynameinput` removed |
| never configured | `null` | V2 defaults (Classic, `#FF3B2F`) | nothing written (no migration needed) |
| empty settings | `{}` | V2 defaults | nothing written |

In every migrated key `watchface` is gone and `face`, `showDate` and `showSeconds` are set, as Task 4 specifies. Keys without stored colours show the new V2 defaults, as the spec intends (V1's default red was `#ab0000`).

## Real profiles

25 V1 clocks were found in the maintainer's profiles before the update, across several devices' profiles, incl. one on a Stream Deck+ dial and two inside Multi Actions (15 of them on the V1 reference page used for the CPU comparison). V2 migrates a key when it first appears; the keys already shown after the update (on the current pages) carry V2 settings (`face: modern` from `watchface "4"`, colours kept). Keys on pages that were not shown yet still hold their V1 settings and migrate when they appear. The two Multi Action clocks had no settings (`null`), so nothing changes for them.

## Result

Passed. No key lost its place or its settings; faces, colours, date and hour formats and the PM indicator carry over.
