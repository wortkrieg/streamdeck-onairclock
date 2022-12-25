# streamdeck-onairclock

A simple broadcast-inspired on air clock for Elgato Stream Deck

## Features

Planned: You can change the appearance colors by simply setting HEX values. 

Planned: Set the watch to display date (dd-mm) and/or seconds or just hh:mm.

## ToDos 

* property inspector:
  * Setting for foreground/dots active color
  * Setting for dots inactive color
  * Setting for background color
  * Enable seconds display checkbox

* Cleanup code fragments from samples & template
* Create preview images
* Make actually useful manifest.json
* Experiment with dot size to improve readability

## Ideas
* Keypress-Action
* Show Date option

## Installation

### From elgato plugin store

The plugin is not submitted yet. Will do this once all features are included and tested enough.

### Manually from github

#### Mac

Go to 

    '~/Library/Application Support/com.elgato.StreamDeck/Plugins/'

and copy the fail.marc.onairclock.sdPlugin folder there.

Then relaunch streamdeck software.

#### Windows 

Go to

    '%appdata%\Elgato\StreamDeck\Plugins'

and copy the fail.marc.onairclock.sdPlugin folder there.

Then relaunch streamdeck software.

## Developing

Follow [this tutorial](https://developer.elgato.com/documentation/stream-deck/sdk/create-your-own-plugin/) for advice on how to debug the plugin.

## Dependencies

Currently just the official [Stream Deck SDK](https://developer.elgato.com/documentation/stream-deck/sdk/overview/).

## Disclaimer

I made this plugin just for fund and because I thought it would be handy to have a plugin like that. Therefore, it is released under MIT license. Do what ever you want with it, but it comes without warranty of any kind.

However, an acknowledgement would be nice.

## Acknowledgements

This plugin is based on the [elgato plugin template](https://github.com/elgatosf/streamdeck-plugintemplate).
The clock calculation and drawing routine is inspired by [this kirupa tutorial](https://www.kirupa.com/html5/create_an_analog_clock_using_the_canvas.htm).