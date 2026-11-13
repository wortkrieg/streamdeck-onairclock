import {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type KeyUpEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import { type AdjustSettingsStored, normalizeAdjust } from "../core/settings";
import { COUNTDOWN_MINUS_UUID, COUNTDOWN_PLUS_UUID } from "../ids";
import { type AdjustDirection, renderAdjustKey } from "../render/adjust-key";
import { toDataUri } from "../render/svg";
import type { CountdownController } from "./countdown-controller";
import type { KeyRepeater } from "./key-repeat";

type ShownEvent =
	| WillAppearEvent<AdjustSettingsStored>
	| DidReceiveSettingsEvent<AdjustSettingsStored>;

/** Countdown + and −: a thin bridge from Stream Deck events to CountdownController.adjust. */
abstract class AdjustAction extends SingletonAction<AdjustSettingsStored> {
	protected abstract readonly direction: AdjustDirection;

	constructor(
		private readonly countdowns: CountdownController,
		private readonly requestFrame: () => void,
		private readonly repeater: KeyRepeater,
		private readonly log: (message: string) => void,
	) {
		super();
	}

	override onWillAppear(ev: WillAppearEvent<AdjustSettingsStored>): void {
		this.draw(ev);
	}

	override onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<AdjustSettingsStored>,
	): void {
		this.draw(ev);
	}

	override onWillDisappear(ev: WillDisappearEvent<AdjustSettingsStored>): void {
		this.repeater.stop(ev.action.id);
	}

	override onKeyDown(ev: KeyDownEvent<AdjustSettingsStored>): void {
		const { stepSec } = normalizeAdjust(ev.payload.settings);
		const deltaSec = this.direction === "plus" ? stepSec : -stepSec;
		const deviceId = ev.action.device.id;
		this.repeater.start(ev.action.id, () => {
			const result = this.countdowns.adjust(deviceId, deltaSec, Date.now());
			this.requestFrame();
			// Nothing running and no adjustable countdown key on this page.
			if (result === "none") ev.action.showAlert().catch(() => {});
			return result !== "none";
		});
	}

	override onKeyUp(ev: KeyUpEvent<AdjustSettingsStored>): void {
		this.repeater.stop(ev.action.id);
	}

	private draw(ev: ShownEvent): void {
		const a = ev.action;
		if (!a.isKey()) return;
		const cfg = normalizeAdjust(ev.payload.settings);
		a.setImage(
			toDataUri(renderAdjustKey(this.direction, cfg.stepSec, cfg.color)),
		).catch((err: unknown) => {
			this.log(`drawing countdown step key ${a.id} failed: ${String(err)}`);
		});
	}
}

@action({ UUID: COUNTDOWN_PLUS_UUID })
export class CountdownPlusAction extends AdjustAction {
	protected readonly direction = "plus";
}

@action({ UUID: COUNTDOWN_MINUS_UUID })
export class CountdownMinusAction extends AdjustAction {
	protected readonly direction = "minus";
}
