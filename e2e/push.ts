import type { Page } from '@playwright/test';

// A test browser has no push service, so the browser's subscription is faked (plan U12, F8).

export const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/e2e-phone';

/**
 * Stands in for the browser's push service: permission granted when asked, and one
 * subscription, kept across reloads as a browser keeps it.
 */
export async function fakePush(page: Page, endpoint = ENDPOINT) {
	await page.addInitScript((endpoint) => {
		const key = btoa(String.fromCharCode(4, ...Array.from({ length: 64 }, (_, i) => i)))
			.replaceAll('+', '-')
			.replaceAll('/', '_')
			.replace(/=+$/, '');
		const auth = 'AAECAwQFBgcICQoLDA0ODw';
		const kept = 'e2e-fake-push';
		let permission: NotificationPermission =
			localStorage.getItem(`${kept}-permission`) === 'granted' ? 'granted' : 'default';
		Object.defineProperty(Notification, 'permission', { get: () => permission });
		Notification.requestPermission = async () => {
			localStorage.setItem(`${kept}-permission`, 'granted');
			return (permission = 'granted');
		};
		const make = () =>
			({
				endpoint,
				toJSON: () => ({ endpoint, keys: { p256dh: key, auth } }),
				unsubscribe: async () => {
					subscription = null;
					localStorage.removeItem(kept);
					return true;
				}
			}) as unknown as PushSubscription;
		let subscription: PushSubscription | null = localStorage.getItem(kept) ? make() : null;
		PushManager.prototype.getSubscription = async () => subscription;
		PushManager.prototype.subscribe = async () => {
			localStorage.setItem(kept, '1');
			return (subscription = make());
		};
	}, endpoint);
}
