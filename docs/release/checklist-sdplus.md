# Test checklist: Stream Deck+ (macOS)

Device: Stream Deck+, Stream Deck software 7.1 or newer. Install the V2 build (release `.streamDeckPlugin` or dev variant).

## Migration from V1 (do this first)

- [ ] Back up the Stream Deck profile folder, install V1, and configure clocks on keys (different faces, colors, 12h with PM indicator, a date format).
- [ ] Install V2 over V1: all keys are still there, keep their colors, 12/24h, PM indicator and date format; none is blank or reset.
- [ ] A V1 key that was never configured shows a clock with the V2 defaults.

## Faces and options

- [ ] Classic shows 60 dots and hour marks; "Show date" and "Show seconds" toggle the date and seconds.
- [ ] Modern Minimal, Line, Comet and Big each render correctly and the digits are readable.
- [ ] Active, inactive and background colors change the clock immediately.
- [ ] Animations on: digits roll, the ring resets at the full minute, the colon blinks, the afterglow is visible. With animations off, they stop.
- [ ] The five date formats and 12/24h with the PM indicator work.

## Time zone

- [ ] IANA zone (e.g. America/New_York) shows the correct time; the label (e.g. `NYC`) is shown and readable.
- [ ] Fixed UTC offset, including a 15-minute step such as +05:45, shows the correct time.

## Countdown

- [ ] Countdown key starts the countdown on all clocks with "Show countdown" enabled; a clock with it disabled keeps showing the time.
- [ ] End mode "Count overtime": after 00:00 it continues as +MM:SS.
- [ ] End mode "Hold at 00:00": it stays at 00:00 and blinks until canceled.
- [ ] End mode "Back to clock": it flashes briefly and shows the time again.
- [ ] Warning pulse in the last 10 seconds appears when enabled and not when disabled.
- [ ] Pressing the Countdown key again, or a clock, cancels the countdown.

## Stream Deck+ touch display

- [ ] The clock is shown correctly on the touch display and updates every second.
- [ ] A running countdown is shown on the touch display, and pushing the dial cancels it.
