# Test checklist: Windows 10/11

Device: any Stream Deck with display, Stream Deck software 7.1 or newer. Install the V2 build (release `.streamDeckPlugin`).

## Install and migration from V1

- [ ] Install the `.streamDeckPlugin`; "On Air Clock" appears in the action list with a clock action and a countdown action. On a fresh Stream Deck install the clock appears once Stream Deck has downloaded its Node.js runtime (needs internet once).
- [ ] With V1 previously installed and configured: after installing V2 all keys are still there and keep colors, 12/24h, PM indicator and date format. A key that never had settings shows a clock with the V2 defaults.

## Faces and options

- [ ] Classic shows 60 dots and hour marks; "Show date" and "Show seconds" toggle correctly.
- [ ] Modern Minimal, Line, Comet and Big each render correctly; digits look the same as on macOS.
- [ ] Active, inactive and background colors change the clock immediately.
- [ ] Animations (digit roll, ring reset, afterglow) and the blinking colon run smoothly and can each be switched off.
- [ ] The five date formats and 12/24h with the PM indicator work.

## Time zone

- [ ] System time matches the Windows clock.
- [ ] IANA zone (e.g. America/New_York) and label (e.g. `NYC`) are correct and readable.
- [ ] Fixed UTC offset (try -07:00 and +05:45) shows the correct time. This is the fix for "Wrong time?".
- [ ] Change the Windows time zone while Stream Deck runs (Settings > Time & language > Date & time). Clocks on "System time" follow within about 10 seconds; clocks with an IANA zone or fixed offset do not change. Switch back afterwards.

## Countdown

- [ ] Countdown starts on all clocks with "Show countdown" enabled; a clock with it disabled keeps showing the time. Pressing the Countdown key again, or a clock, cancels it.
- [ ] End modes: "Count overtime" continues as +MM:SS, "Hold at 00:00" stays and blinks until canceled, "Back to clock" flashes and shows the time again.
- [ ] With many clocks visible (e.g. 15 keys) the Stream Deck software stays responsive and CPU load is low.
