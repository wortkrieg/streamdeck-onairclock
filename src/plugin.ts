import streamDeck from "@elgato/streamdeck";
import { FAST_FPS } from "./hardware";
import { ClockAction } from "./plugin/clock-action";
import { ClockController } from "./plugin/clock-controller";
import { countdowns } from "./plugin/registry";
import { combineFrames, type FrameFn, Ticker } from "./plugin/ticker";

const log = streamDeck.logger.createScope("OnAirClock");
const warn = (message: string): void => {
	log.warn(message);
};

const clocks = new ClockController(countdowns, warn);

/** Every controller's frame; the shared ticker runs them together. */
const frames: FrameFn[] = [(nowMs) => clocks.frame(nowMs)];
const ticker = new Ticker(
	combineFrames(frames),
	FAST_FPS,
	() => Date.now(),
	warn,
);

streamDeck.actions.registerAction(new ClockAction(clocks, () => ticker.kick()));

await streamDeck.connect();
ticker.start();
