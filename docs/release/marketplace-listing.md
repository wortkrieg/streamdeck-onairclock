# Marketplace listing: On Air Clock

## Name

On Air Clock

## Claim

- EN: Studio clocks in any color, on any key.
- DE: Studiouhren in jeder Farbe, auf jeder Taste.

## Short description

- EN: A broadcast studio clock for your Stream Deck: five watchfaces, any color, time zones and a countdown.
- DE: Eine Rundfunk-Studiouhr für dein Stream Deck: fünf Ziffernblätter, jede Farbe, Zeitzonen und ein Countdown.

## Long description (EN)

On Air Clock turns any Stream Deck key into a broadcast-style studio clock. Choose one of five watchfaces, set every color yourself, show any time zone and run a countdown on all your clocks at once. Requires Stream Deck 7.1 or newer on macOS 12+ or Windows 10+.

Watchfaces: Classic (60 dots, hour marks, optional date and seconds), Modern Minimal, Line, Comet and Big, all with large digits that read well from a distance. Line, Comet and Big sweep their ring smoothly through the minute.

Colors: set the active color, the inactive color and the background freely. Optionally the time gets its own color, apart from the ring ("Time color").

Time zones: every key can show the system time, an IANA time zone or a fixed UTC offset (-12:00 to +14:00 in 15-minute steps). Add a short label such as NYC to tell world clocks apart.

Countdown: the Countdown action starts a preset duration of up to 99:59 on all clocks of the same Stream Deck that have "Show countdown" enabled. Countdown + and − set the duration in steps of minutes or seconds, and add or take time while it runs. At zero the clock counts overtime (+MM:SS), holds at 00:00 or goes back to the time. An optional warning pulse marks the last 10 seconds.

Details: rolling digits, ring reset, blinking colon and afterglow (each can be switched off), five date formats, 12 or 24 hour display with PM indicator, Stream Deck+ touch display support. Updating from version 1 keeps your keys and settings.

## Long description (DE)

Not for the Marketplace (English only); for the blog, the product page and German readers.

On Air Clock macht jede Stream-Deck-Taste zur Studiouhr im Rundfunk-Stil. Wähle eines von fünf Ziffernblättern, stelle jede Farbe selbst ein, zeige jede Zeitzone an und starte einen Countdown auf allen Uhren gleichzeitig. Voraussetzung: Stream Deck 7.1 oder neuer auf macOS 12+ oder Windows 10+.

Ziffernblätter: Classic (60 Punkte, Stundenmarken, optional Datum und Sekunden), Modern Minimal, Line, Comet und Big, alle mit großen Ziffern, die auch aus der Entfernung lesbar sind. Bei Line, Comet und Big läuft der Ring flüssig durch die Minute.

Farben: Aktiv-Farbe, Inaktiv-Farbe und Hintergrund stellst du frei ein. Auf Wunsch bekommt die Uhrzeit eine eigene Farbe, getrennt vom Ring („Time color“).

Zeitzonen: Jede Taste zeigt die Systemzeit, eine IANA-Zeitzone oder einen festen UTC-Versatz (-12:00 bis +14:00 in 15-Minuten-Schritten). Mit einer kurzen Beschriftung wie NYC unterscheidest du Weltzeituhren.

Countdown: Die Countdown-Aktion startet eine voreingestellte Dauer von bis zu 99:59 auf allen Uhren desselben Stream Decks, bei denen „Show countdown“ aktiviert ist. Countdown + und − stellen die Dauer in Minuten- oder Sekundenschritten ein und geben während des Laufs Zeit dazu oder ziehen sie ab. Bei null zählt die Uhr das Überziehen weiter (+MM:SS), bleibt bei 00:00 stehen oder kehrt zur Uhrzeit zurück. Eine optionale Warnung pulsiert in den letzten 10 Sekunden.

Details: rollende Ziffern, Ring-Reset, blinkender Doppelpunkt und Nachglühen (jeweils abschaltbar), fünf Datumsformate, 12- oder 24-Stunden-Anzeige mit PM-Markierung, Unterstützung für das Touch-Display des Stream Deck+. Beim Update von Version 1 bleiben deine Tasten und Einstellungen erhalten.

## Tags

clock, time zone, countdown, broadcast, studio

## Gallery images

1. `marketing/gallery-1-hero.png`: hero, the claim with clocks in several colors (also the thumbnail)
2. `marketing/store-video.mp4`: 29.5 s video, faces, countdown, world clocks, colors (1920 x 1080)
3. `marketing/gallery-2-faces.png`: the five watchfaces
4. `marketing/gallery-5-colors.png`: ring and time in separate colors
5. `marketing/gallery-3-timezones.png`: world clocks with time zones and labels
6. `marketing/gallery-4-countdown.png`: countdown on the clock

Icon: `marketing/marketplace-icon.png`

## Release notes 2.0.0

For the release notes field of the version in the Maker Console (under 1,500 characters, currently 1,264). Plain text.

```text
On Air Clock 2.0 is a complete rebuild. Your existing keys keep their settings.

New
- Three new watchfaces: Line, Comet and Big, next to Classic and Modern Minimal. All with larger digits that read well from a distance.
- Time zone per key: system time, any time zone or a fixed UTC offset, plus a short label such as NYC for world clocks.
- Countdown action: starts a preset duration of up to 99:59 on all clocks of the same Stream Deck. At zero it counts overtime, holds at 00:00 or goes back to the time. An optional pulse warns in the last 10 seconds.
- Countdown + and Countdown −: set the duration in steps of minutes or seconds, and add or take time while the countdown runs.
- The time can have its own color, apart from the ring.
- Small animations: rolling digits, a smoothly sweeping ring and a blinking colon. Each can be switched off.

Changed
- Rebuilt on the current Stream Deck SDK. The clock looks the same on macOS and Windows and uses less CPU on the dot faces.
- The V1 faces without date or seconds are now options of Classic.

Fixed
- Wrong time in British Columbia and other regions with outdated time zone data.

Requires Stream Deck 7.1 or newer on macOS 12+ or Windows 10+. On first start, Stream Deck downloads its Node.js runtime once.
```

## Submission (Maker Console)

Checked against docs.elgato.com/guidelines/products and /guidelines/submissions (2026-11-12).

- Name: "On Air Clock" (English, under 30 characters, no "Plugin", no Maker name).
- Description: the EN long description above, 250 to 1,500 characters (currently about 1,460), the first 250 characters plain text and including the requirements.
- Thumbnail: static PNG 1920 x 960 with English text: `marketing/gallery-1-hero.png`.
- App icon: PNG 288 x 288: `marketing/marketplace-icon.png`.
- Gallery (3 to 10 items, PNG 1920 x 960, video MP4 1920 x 1080 under 250 MB), in this order: hero, `marketing/store-video.mp4`, faces, colors (`gallery-5-colors.png`), time zones, countdown.
- Release notes: the section "Release notes 2.0.0" above.
- AI use must be declared: the plugin code, texts and generated artwork were created with AI assistance (Claude) and reviewed by the maintainer.
