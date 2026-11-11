# Test checklist: Windows 10/11

Device: any Stream Deck with display, Stream Deck software 7.1 or newer. Install the V2 build (release `.streamDeckPlugin`).

## Install and migration from V1

- [ ] Install the `.streamDeckPlugin`; "On Air Clock" appears in the action list with a clock action and a countdown action.
- [ ] With V1 previously installed and configured: after installing V2 all keys are still there and keep colors, 12/24h, PM indicator and date format.
- [ ] A key that never had settings shows a clock with the V2 defaults.

## Faces and options

- [ ] Classic shows 60 dots and hour marks; "Show date" and "Show seconds" toggle correctly.
- [ ] Modern Minimal, Line, Comet and Big each render correctly; digits look the same as on macOS.
- [ ] Active, inactive and background colors change the clock immediately.
- [ ] Animations (digit roll, ring reset, blinking colon, afterglow) run smoothly and can be switched off.
- [ ] The five date formats and 12/24h with the PM indicator work.

## Time zone

- [ ] System time matches the Windows clock.
- [ ] IANA zone (e.g. America/New_York) and label (e.g. `NYC`) are correct and readable.
- [ ] Fixed UTC offset (try -07:00 and +05:45) shows the correct time. This is the fix for "Wrong time?".

## Countdown

- [ ] Countdown starts on all clocks with "Show countdown" enabled; a clock with it disabled keeps showing the time.
- [ ] End mode "Count overtime" continues as +MM:SS.
- [ ] End mode "Hold at 00:00" stays at 00:00 and blinks until canceled.
- [ ] End mode "Back to clock" flashes briefly and shows the time again.
- [ ] Pressing the Countdown key again, or a clock, cancels the countdown.
- [ ] With many clocks visible (e.g. 15 keys) the Stream Deck software stays responsive and CPU load is low.
