import { audio } from './sound.ts';

/**
 * Which speaker the app plays on (plan U11, Trevor 2026-10-27: "options for output (eg device
 * speakers, external speakers...)"). Every sound shares one audio context, so choosing its
 * output moves them all. Only Chrome and Edge on a computer can choose
 * (`AudioContext.setSinkId`, Chrome 110); a phone's own output switcher or Control Center
 * decides there, so the setting is disabled. A browser shows speakers' names only after
 * microphone permission; nothing is ever recorded.
 */

type SinkContext = AudioContext & { setSinkId(id: string): Promise<void> };

export interface Speaker {
	id: string;
	label: string;
}

/** This browser can send the app's sound to a speaker of the user's choice. */
export function canChooseSpeaker(): boolean {
	return (
		typeof AudioContext !== 'undefined' &&
		'setSinkId' in AudioContext.prototype &&
		typeof navigator !== 'undefined' &&
		!!navigator.mediaDevices?.enumerateDevices &&
		// Android lists one output and routes by its own switcher (MDN compat data, crbug 41276355).
		!/Android/i.test(navigator.userAgent)
	);
}

/** Sends the app's sound to a speaker; an empty id, or one no longer there, is the default. */
export async function useSpeaker(id: string): Promise<void> {
	const ctx = audio() as SinkContext | undefined;
	if (!ctx || !canChooseSpeaker()) return;
	try {
		await ctx.setSinkId(id);
	} catch {
		await ctx.setSinkId('').catch(() => {});
	}
}

class Speakers {
	list = $state.raw<Speaker[]>([]);
	/** The browser gives the speakers' names (microphone permission was given). */
	named = $state(false);

	async refresh(): Promise<void> {
		if (!canChooseSpeaker()) return;
		const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
		const outputs = devices.filter(
			(device) => device.kind === 'audiooutput' && device.deviceId !== 'default' && device.deviceId
		);
		this.named = outputs.some((device) => device.label);
		this.list = outputs.map((device) => ({ id: device.deviceId, label: device.label }));
	}

	/** Asks for microphone permission once, only so the browser names the speakers. */
	async showNames(): Promise<void> {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			for (const track of stream.getTracks()) track.stop();
		} catch {
			// Refused: the speakers stay numbered.
		}
		await this.refresh();
	}
}

export const speakers = new Speakers();
