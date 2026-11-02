/**
 * Game invites on a phone with the app closed (plan F8): someone who turns on "Notify me of game
 * invites" on Friends gives their account this device's push address (web-push.ts), and a
 * friend's invite (plan F4) is pushed to each one. Invites only, never other friend news
 * (Trevor: friends must not be spammy), and off until turned on.
 */
import type { PushAddress } from './web-push.ts';

/** Devices one account keeps for invite notifications; the newest are kept. */
export const MAX_PUSH_DEVICES = 5;

/**
 * An invite is about a game starting soon: a phone off for longer than this would only hear
 * it late, so the push service drops it then.
 */
export const INVITE_PUSH_TTL_SECONDS = 60 * 60;

/** One device an account gets invite notifications on, and when it was last added. */
export interface PushDevice extends PushAddress {
	at: number;
}

/**
 * The account's devices with `address` added (or renewed, by its endpoint), newest first, at
 * most `MAX_PUSH_DEVICES`: a device past the cap is the one used longest ago.
 */
export function addPushDevice(
	devices: readonly PushDevice[],
	address: PushAddress,
	now: number
): PushDevice[] {
	const others = devices.filter((device) => device.endpoint !== address.endpoint);
	const added: PushDevice = { endpoint: address.endpoint, keys: { ...address.keys }, at: now };
	return [added, ...others].sort((a, b) => b.at - a.at).slice(0, MAX_PUSH_DEVICES);
}

/** The devices left when the push service said these endpoints are gone, or one turned off. */
export function dropPushDevices(
	devices: readonly PushDevice[],
	endpoints: Iterable<string>
): PushDevice[] {
	const gone = new Set(endpoints);
	return devices.filter((device) => !gone.has(device.endpoint));
}

/**
 * What an invite push carries: who sent it and the game's script name, never the room code
 * (a tap opens Friends, whose invite has Join). The service worker words it.
 */
export interface InvitePushMessage {
	type: 'friend-invite';
	/** The Storyteller's username; null when their account has none. */
	from: string | null;
	/** The script's name, as the invite shows it; empty when there was none. */
	title: string;
}

/** The longest script name a push carries, so the message stays well inside one record. */
const MAX_PUSH_TITLE = 100;

export function invitePushMessage(from: string | null, title: string): InvitePushMessage {
	return { type: 'friend-invite', from, title: title.trim().slice(0, MAX_PUSH_TITLE) };
}

/** Where a tap on an invite notification opens: the Friends page, whose invites have Join. */
export const INVITE_PUSH_PATH = '/friends';

/**
 * The notification's words, from English templates (the service worker can't read the app's
 * language): `{name}` is the Storyteller, `{title}` the script.
 */
export function inviteNotification(
	message: InvitePushMessage,
	words: { title: string; body: string; bodyWithScript: string; someone: string }
): { title: string; body: string } {
	const name = message.from || words.someone;
	const template = message.title ? words.bodyWithScript : words.body;
	return {
		title: words.title,
		// One pass, so a name or script that holds "{title}" or "$&" is shown as it is.
		body: template.replace(/\{(name|title)\}/g, (_, key: string) =>
			key === 'name' ? name : message.title
		)
	};
}
