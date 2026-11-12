# GitHub repository settings for V2

Draft for the maintainer's review; applied with `gh` only after approval.

## Description

Current: "Simple On Air Clock for Elgato Stream Deck"

New: "Broadcast-style studio clocks for Elgato Stream Deck: five watchfaces, any color, time zones and a countdown."

## Website

Unchanged: https://marc.fail/onairclock/

## Topics

Keep: `elgato-stream-deck`, `streamdeck`, `streamdeck-plugin`, `stream-deck-plugin`, `streamdeck-sdk`

Add: `clock`, `studio-clock`, `on-air`, `countdown`, `world-clock`, `timezone`, `broadcast`, `typescript`

## Social preview

`marketing/social-preview.png` (1280 x 640). GitHub's API cannot set it: upload it in the repository Settings under "Social preview".

## Commands (after approval)

```sh
gh repo edit wortkrieg/streamdeck-onairclock \
  --description "Broadcast-style studio clocks for Elgato Stream Deck: five watchfaces, any color, time zones and a countdown." \
  --add-topic clock --add-topic studio-clock --add-topic on-air --add-topic countdown \
  --add-topic world-clock --add-topic timezone --add-topic broadcast --add-topic typescript
```
