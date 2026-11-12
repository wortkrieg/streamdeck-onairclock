import {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import {
	type CountdownSettingsStored,
	normalizeCountdown,
} from "../core/settings";
import { COUNTDOWN_UUID } from "../ids";
import type { CountdownController } from "./countdown-controller";

/** The countdown action: a thin bridge from Stream Deck events to the CountdownController. */
@action({ UUID: COUNTDOWN_UUID })
export class CountdownAction extends SingletonAction<CountdownSettingsStored> {
	constructor(
		private readonly countdowns: CountdownController,
		private readonly requestFrame: () => void,
	) {
		super();
	}

	override onWillAppear(ev: WillAppearEvent<CountdownSettingsStored>): void {
		const a = ev.action;
		this.countdowns.add(
			{
				id: a.id,
				deviceId: a.device.id,
				draw: (uri) => (a.isKey() ? a.setImage(uri) : Promise.resolve()),
			},
			normalizeCountdown(ev.payload.settings),
		);
		this.requestFrame();
	}

	override onWillDisappear(
		ev: WillDisappearEvent<CountdownSettingsStored>,
	): void {
		this.countdowns.remove(ev.action.id);
	}

	override onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<CountdownSettingsStored>,
	): void {
		this.countdowns.update(
			ev.action.id,
			normalizeCountdown(ev.payload.settings),
		);
		this.requestFrame();
	}

	override onKeyDown(ev: KeyDownEvent<CountdownSettingsStored>): void {
		this.countdowns.press(ev.action.id, Date.now());
		this.requestFrame();
	}
}
