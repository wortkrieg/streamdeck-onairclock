# Changelog

## 2.0.0 (2026-11-13)

On Air Clock V2 is a complete rebuild. The plugin ID is unchanged, so existing keys keep their settings.

### Added

- Three new watchfaces: Line, Comet and Big. Classic and Modern Minimal remain.
- Time zone per key: system time, IANA time zone or fixed UTC offset (-12:00 to +14:00, 15-minute steps), plus an optional short label of up to 6 characters (#2).
- Countdown action with a preset duration of up to 99:59. It starts on all clocks of the same Stream Deck that have "Show countdown" enabled. Pressing the Countdown key again, or a clock, cancels it (#7).
- Three end modes for the countdown: count overtime (+MM:SS, default), hold at 00:00, back to clock. Optional warning pulse in the last 10 seconds.
- Countdown + and Countdown − actions: they set the duration of the Countdown keys on the same page in steps of 1 to 99 minutes or seconds, and add or take time while a countdown runs. Holding the key repeats the step. A Countdown key keeps a fixed duration with "Change the duration" switched off.
- Micro animations, on by default: rolling digits, ring reset, blinking colon, afterglow, smoothly sweeping ring on Line, Comet and Big. Animations and the blinking colon can each be switched off.
- Optional separate color for the time (digits, date, label), apart from the ring ("Time color").
- New branding, icons and Marketplace artwork.

### Changed

- Rebuilt on the current Stream Deck SDK (Node.js, TypeScript) with SVG rendering and custom digit shapes, so the clock looks identical on macOS and Windows.
- One shared clock tick for all keys instead of one timer per key.
- The former V1 faces without date and/or seconds are now options of Classic ("Show date", "Show seconds").
- New defaults apply to every key without a stored value, including V1 clocks that were never configured.
- Larger digits and labels that read well from a distance; lower CPU load than V1 with the dot faces.
- Clocks on "System time" follow a changed system time zone within about 10 seconds.
- Requires Stream Deck software 7.1 or newer, macOS 12+ or Windows 10+. Users on older Stream Deck versions keep V1. On first use Stream Deck downloads its Node.js runtime once (needs internet access).

### Fixed

- Wrong time in British Columbia (#10): V2 runs on Stream Deck's Node.js runtime, whose time zone data is current. If a region's time is ever off by an hour, choose "Fixed UTC offset" in the key settings.
