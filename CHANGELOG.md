# Changelog

## 2.0.0

On Air Clock V2 is a complete rebuild. The plugin ID is unchanged, so existing keys keep their settings.

### Added
- Three new watchfaces: Line, Comet and Big. Classic and Modern Minimal remain.
- Time zone per key: system time, IANA time zone or fixed UTC offset (-12:00 to +14:00, 15-minute steps), plus an optional short label of up to 6 characters (#2).
- Countdown action with a preset duration of up to 99:59. It starts on all clocks of the same Stream Deck that have "Show countdown" enabled. Pressing the Countdown key again, or a clock, cancels it (#7).
- Three end modes for the countdown: count overtime (+MM:SS, default), hold at 00:00, back to clock. Optional warning pulse in the last 10 seconds.
- Micro animations, on by default: rolling digits, ring reset, blinking colon, afterglow. Animations and the blinking colon can each be switched off.
- New branding, icons and Marketplace artwork.

### Changed
- Rebuilt on the current Stream Deck SDK (Node.js, TypeScript) with SVG rendering and custom digit shapes, so the clock looks identical on macOS and Windows.
- One shared clock tick for all keys instead of one timer per key.
- The former V1 faces without date and/or seconds are now options of Classic ("Show date", "Show seconds").
- New defaults apply to every key without a stored value, including V1 clocks that were never configured.
- Requires Stream Deck software 7.1 or newer, macOS 12+ or Windows 10+. Users on older Stream Deck versions keep V1.

### Fixed
- Wrong time in regions whose time zone data is outdated in the runtime: choose "Fixed UTC offset" in the key settings (#10).
