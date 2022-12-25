#!/bin/sh

#this script works mac only!

# Shoot stream deck app
pkill -x "Stream Deck"

# Simply remove the old folder in streamdeck's plugin folder and replace by current one. Has to be replaced by own path.
rm -r "/Users/marc/Library/Application Support/com.elgato.StreamDeck/Plugins/fail.marc.onairclock.sdPlugin"

cp -a fail.marc.onairclock.sdPlugin/ "/Users/marc/Library/Application Support/com.elgato.StreamDeck/Plugins/fail.marc.onairclock.sdPlugin"

#launch stream deck app
open -a "Elgato Stream Deck"