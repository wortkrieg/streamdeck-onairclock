import streamDeck from "@elgato/streamdeck";
import { FAST_FPS } from "./hardware";
import {
	CountdownMinusAction,
	CountdownPlusAction,
} from "./plugin/adjust-action";
import { ClockAction } from "./plugin/clock-action";
import { ClockController } from "./plugin/clock-controller";
import { CountdownAction } from "./plugin/countdown-action";
import { CountdownController } from "./plugin/countdown-controller";
import { KeyRepeater } from "./plugin/key-repeat";
import { countdowns } from "./plugin/registry";
import { watchSystemZone } from "./plugin/system-zone";
import { combineFrames, type FrameFn, Ticker } from "./plugin/ticker";

const log = streamDeck.logger.createScope("OnAirClock");
const warn = (message: string): void => {
	log.warn(message);
};

const clocks = new ClockController(countdowns, warn);
const countdownKeys = new CountdownController(countdowns, warn);

/** Every controller's frame; the shared ticker runs them together. */
const frames: Record<string, FrameFn> = {
	clocks: (nowMs) => clocks.frame(nowMs),
	countdowns: (nowMs) => countdownKeys.frame(nowMs),
};
const ticker = new Ticker(
	combineFrames(frames, warn),
	FAST_FPS,
	() => Date.now(),
	warn,
);

streamDeck.actions.registerAction(new ClockAction(clocks, () => ticker.kick()));
streamDeck.actions.registerAction(
	new CountdownAction(countdownKeys, () => ticker.kick()),
);
const repeater = new KeyRepeater((err) => {
	warn(`countdown step failed: ${String(err)}`);
});
for (const Adjust of [CountdownPlusAction, CountdownMinusAction])
	streamDeck.actions.registerAction(
		new Adjust(countdownKeys, () => ticker.kick(), repeater, warn),
	);

await streamDeck.connect();
ticker.start();
// Clocks on "System time" follow a changed system time zone within ZONE_CHECK_MS.
watchSystemZone();
