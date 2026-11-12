import {
	type Action,
	action,
	type DialDownEvent,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	SingletonAction,
	type TouchTapEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import {
	type ClockSettingsStored,
	migrateV1,
	normalizeClock,
} from "../core/settings";
import { CLOCK_UUID } from "../ids";
import type { ClockController, ClockTarget } from "./clock-controller";

function toTarget(a: Action<ClockSettingsStored>): ClockTarget {
	return {
		id: a.id,
		deviceId: a.device.id,
		kind: a.isKey() ? "key" : "dial",
		draw: (uri) => {
			if (a.isKey()) return a.setImage(uri);
			if (a.isDial()) return a.setFeedback({ icon: uri });
			return Promise.resolve();
		},
	};
}

/** The clock action: a thin bridge from Stream Deck events to the ClockController. */
@action({ UUID: CLOCK_UUID })
export class ClockAction extends SingletonAction<ClockSettingsStored> {
	constructor(
		private readonly clocks: ClockController,
		private readonly requestFrame: () => void,
	) {
		super();
	}

	override async onWillAppear(
		ev: WillAppearEvent<ClockSettingsStored>,
	): Promise<void> {
		const { settings, changed } = migrateV1(ev.payload.settings);
		// Register before the await so a quick disappear cannot leave a stale clock behind.
		this.clocks.add(toTarget(ev.action), normalizeClock(settings));
		this.requestFrame();
		if (changed) await ev.action.setSettings(settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<ClockSettingsStored>): void {
		this.clocks.remove(ev.action.id);
	}

	override async onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<ClockSettingsStored>,
	): Promise<void> {
		const { settings, changed } = migrateV1(ev.payload.settings);
		this.clocks.update(ev.action.id, normalizeClock(settings));
		this.requestFrame();
		if (changed) await ev.action.setSettings(settings);
	}

	override onKeyDown(ev: KeyDownEvent<ClockSettingsStored>): void {
		this.press(ev.action.id);
	}

	override onDialDown(ev: DialDownEvent<ClockSettingsStored>): void {
		this.press(ev.action.id);
	}

	override onTouchTap(ev: TouchTapEvent<ClockSettingsStored>): void {
		this.press(ev.action.id);
	}

	private press(id: string): void {
		this.clocks.press(id, Date.now());
		this.requestFrame();
	}
}
