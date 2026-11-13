# Issue comment drafts

Drafts only. The maintainer posts and closes the issues himself. "Where to get it" depends on the moment of posting: the GitHub release is out first, the Marketplace update follows after Elgato's review.

## #2 Time zones (solved in 2.0.0)

On Air Clock 2.0.0 is out, and it finally brings time zones. Every key has its own setting now: system time, any time zone from a list (e.g. America/New_York), or a fixed UTC offset (-12:00 to +14:00 in 15-minute steps). A short label of up to 6 characters, like "NYC", keeps several clocks apart, newsroom style. The date formats from earlier in this thread are still there (five formats, incl. MM-DD), as is 12 or 24 hours with a PM marker.

You need Stream Deck 7.1 or newer. Get it from the [GitHub release](https://github.com/wortkrieg/streamdeck-onairclock/releases/tag/v2.0.0) now, or as an update in the Elgato Marketplace once Elgato has reviewed it. Your existing keys keep their settings. Closing this, thanks for the patience.

## #7 Button action (solved in 2.0.0)

2.0.0 adds a Countdown action. Put it on a key, set a duration (up to 99:59) and press it: the countdown runs on all clocks of the same Stream Deck that have "Show countdown" enabled. Press the Countdown key again, or a clock, to cancel. At zero the clock counts the overtime (+MM:SS), holds at 00:00 or goes back to the time, and an optional pulse warns in the last 10 seconds.

For your example there are also Countdown + and Countdown − keys. Put them next to a Countdown key: each press changes its duration by a step you choose (1 to 99 minutes or seconds, hold to repeat), and while the countdown runs they add or take time. Or put several Countdown keys with fixed durations (1 min, 5 min, ...) into a folder. Pressing one starts it, and the clocks keep showing it after you leave the folder. What a plugin can't do is jump into or out of folders you created yourself; the Stream Deck SDK doesn't allow that. Closing this with the release.

## #10 Wrong time (solved in 2.0.0)

2.0.0 is out and should fix this. Version 1 ran inside Stream Deck's built-in browser engine, whose time zone data apparently still had British Columbia on the old rules. Version 2 runs on the Node.js runtime of current Stream Deck versions. With Stream Deck 7.6.1 (Node.js 24.22.1, time zone data 2026e) America/Vancouver shows UTC-7 correctly.

If "System time" is still an hour off after the update (Windows maps its own time zone names, so that path can differ): open the key settings and pick "America/Vancouver" from the time zone list. That uses the current data and follows future changes. As a last resort, "Fixed UTC offset" with -07:00 always works, but it does not follow daylight saving changes.

You need Stream Deck 7.1 or newer. Get it from the [GitHub release](https://github.com/wortkrieg/streamdeck-onairclock/releases/tag/v2.0.0) or as an update in the Elgato Marketplace once Elgato has reviewed it. Closing this; if it's still wrong for you, reopen with your OS and Stream Deck version.

## #5 Clock across multiple keys (not planned)

Thanks for the idea. I mocked up a clock spanning several keys for 2.0.0, and it didn't look good with the gaps between the keys, so I left it out. Instead each key got bigger digits and a new face called Big (hours and minutes as large as the key allows), plus colors, time zones and a countdown. Closing this as not planned.
