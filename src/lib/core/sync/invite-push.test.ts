import { describe, expect, it } from 'vitest';
import {
	addPushDevice,
	dropPushDevices,
	inviteNotification,
	invitePushMessage,
	MAX_PUSH_DEVICES,
	type PushDevice
} from './invite-push.ts';
import type { PushAddress } from './web-push.ts';

// Plan F8: game invites pushed to a friend's devices, opt-in, invites only.

const address = (n: number): PushAddress => ({
	endpoint: `https://fcm.googleapis.com/fcm/send/${n}`,
	keys: { p256dh: `key${n}`, auth: `auth${n}` }
});

const words = {
	title: 'Game invite',
	body: '{name} invites you to their game',
	bodyWithScript: '{name} invites you to {title}',
	someone: 'A friend'
};

describe('invite notification devices', () => {
	it('adds a device once, renewing it by its endpoint', () => {
		const one = addPushDevice([], address(1), 10);
		expect(one).toEqual([{ ...address(1), at: 10 }]);
		const renewed = addPushDevice(one, { ...address(1), keys: { p256dh: 'new', auth: 'new' } }, 20);
		expect(renewed).toEqual([
			{ endpoint: address(1).endpoint, keys: { p256dh: 'new', auth: 'new' }, at: 20 }
		]);
	});

	it('keeps the newest devices, newest first, up to the cap', () => {
		let devices: PushDevice[] = [];
		for (let n = 1; n <= MAX_PUSH_DEVICES + 2; n++) devices = addPushDevice(devices, address(n), n);
		expect(devices).toHaveLength(MAX_PUSH_DEVICES);
		expect(devices[0].endpoint).toBe(address(MAX_PUSH_DEVICES + 2).endpoint);
		const endpoints = devices.map((device) => device.endpoint);
		expect(endpoints).not.toContain(address(1).endpoint);
		expect(endpoints).not.toContain(address(2).endpoint);
		// Turning an older device on again moves it to the front instead of dropping a newer one.
		const again = addPushDevice(devices, address(3), 100);
		expect(again[0].endpoint).toBe(address(3).endpoint);
		expect(again).toHaveLength(MAX_PUSH_DEVICES);
	});

	it('drops the devices the push service said are gone', () => {
		const devices = [1, 2, 3].map((n) => ({ ...address(n), at: n }));
		expect(dropPushDevices(devices, [address(2).endpoint]).map((d) => d.at)).toEqual([1, 3]);
		expect(dropPushDevices(devices, [])).toEqual(devices);
	});
});

describe('invite push message', () => {
	it('carries the Storyteller and script, never a room code', () => {
		const message = invitePushMessage('ann', '  Trouble Brewing ');
		expect(message).toEqual({ type: 'friend-invite', from: 'ann', title: 'Trouble Brewing' });
		expect(Object.keys(message)).not.toContain('code');
		expect(invitePushMessage(null, 'x'.repeat(500)).title).toHaveLength(100);
	});

	it('words the notification, with or without a script or username', () => {
		expect(inviteNotification(invitePushMessage('ann', 'Trouble Brewing'), words)).toEqual({
			title: 'Game invite',
			body: 'ann invites you to Trouble Brewing'
		});
		expect(inviteNotification(invitePushMessage(null, ''), words).body).toBe(
			'A friend invites you to their game'
		);
		expect(inviteNotification(invitePushMessage('$&{title}', 'S'), words).body).toBe(
			'$&{title} invites you to S'
		);
	});
});
