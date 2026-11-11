# Issue comment drafts

Drafts only. Nothing is posted until the maintainer approves. The maintainer posts and closes the issues.

## #2 Time zones (solved in 2.0.0)

Time zones are in On Air Clock 2.0.0. Each key now has its own time zone setting: system time, an IANA time zone from a list, or a fixed UTC offset (-12:00 to +14:00 in 15-minute steps). You can also add a short label such as "NYC" so several clocks stay easy to tell apart. It needs Stream Deck 7.1 or newer. Closing this with the release, thanks for the request.

## #7 Button action (solved in 2.0.0)

2.0.0 adds a Countdown action. Put it on a key, set a duration (up to 99:59) and press it: the countdown starts on all clocks of the same Stream Deck that have "Show countdown" enabled. Press the Countdown key again, or a clock, to cancel. At zero you can count overtime, hold at 00:00 or go back to the time.

What did not make it: jumping to a folder or profile with a key press. The Stream Deck SDK does not allow plugins to navigate into folders a user created, so that part is not possible from a plugin. Closing this with the release.

## #10 Wrong time (solved in 2.0.0)

This looks like outdated time zone data in the Node.js runtime that Stream Deck provides: British Columbia's switch to permanent UTC-7 shows as UTC-8. We saw the same in local Node v24 (tzdata 2025c). Waiting for Elgato to update the runtime is not needed any more. In 2.0.0, open the key settings, set "Time zone" to "Fixed UTC offset" and choose -07:00. Note that a fixed offset does not follow daylight saving changes by itself. Closing this with the release.

## #5 Clock across multiple keys (not implemented)

Thanks for the idea. I tested a clock spanning several keys in mockups, and it did not look good across the gaps between the keys. So I decided not to build it. Each clock stays on a single key, with five watchfaces, free colors, time zones and a countdown instead. Closing this as not planned.
