import { CountdownRegistry } from "../core/countdown";

/** The one countdown registry, shared by the clock and the countdown action. */
export const countdowns = new CountdownRegistry();
