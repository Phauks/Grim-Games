import { expect, test, type Page } from '@playwright/test';
import { toBoard } from './new-game.ts';
import { openSettingsDialog } from './shell.ts';

// Back to town on a locked phone (plan U12, Trevor 2026-10-28: "back to town only works while
// phone is open, can we make it work while closed?"): the phone gives the room its push
// address, and the room pushes the call to phones not showing the app. A test browser has no
// push service, so the browser's subscription is faked and the test checks what the phone
// tells the room.

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/e2e-phone';

/** Stands in for the browser's push service: permission granted, and one subscription. */
async function fakePush(page: Page) {
	await page.addInitScript((endpoint) => {
		const key = btoa(String.fromCharCode(4, ...Array.from({ length: 64 }, (_, i) => i)))
			.replaceAll('+', '-')
			.replaceAll('/', '_')
			.replace(/=+$/, '');
		const auth = 'AAECAwQFBgcICQoLDA0ODw';
		let permission: NotificationPermission = 'default';
		Object.defineProperty(Notification, 'permission', { get: () => permission });
		Notification.requestPermission = async () => (permission = 'granted');
		let subscription: PushSubscription | null = null;
		PushManager.prototype.getSubscription = async () => subscription;
		PushManager.prototype.subscribe = async () =>
			(subscription = {
				endpoint,
				toJSON: () => ({ endpoint, keys: { p256dh: key, auth } }),
				unsubscribe: async () => ((subscription = null), true)
			} as unknown as PushSubscription);
	}, ENDPOINT);
}

/** What the phone sent the room about push and being on screen, in order. */
function sentToRoom(page: Page): unknown[] {
	const sent: unknown[] = [];
	page.on('websocket', (socket) =>
		socket.on('framesent', ({ payload }) => {
			const message = JSON.parse(String(payload));
			if (message.type === 'push' || message.type === 'showing') sent.push(message);
		})
	);
	return sent;
}

async function openSound(page: Page) {
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Sound' })
		.tap();
	await expect(dialog.getByRole('heading', { name: 'Sound', level: 2 })).toBeVisible();
	return dialog;
}

test('the Worker hands out one push key', async ({ request }) => {
	const first = await (await request.get('/api/push-key')).json();
	expect(first.key).toMatch(/^[A-Za-z0-9_-]{87}$/);
	expect((await (await request.get('/api/push-key')).json()).key).toBe(first.key);
});

test('a phone with alerts on gives the room its push address', async ({
	page,
	browser
}, testInfo) => {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	await page.goto(`${new URL(page.url()).pathname}/room`);
	await expect(page.getByTestId('share-code')).toHaveText(/^\d{3} \d{3}$/);
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');

	const phoneContext = await browser.newContext({ ...testInfo.project.use });
	const phone = await phoneContext.newPage();
	await fakePush(phone);
	const sent = sentToRoom(phone);
	await phone.goto(`/join/${code}`);
	await expect(phone.getByTestId('join-status')).toHaveText('');
	// The app is on screen, so a call reaches it on its socket and isn't pushed.
	await expect.poll(() => sent).toContainEqual({ type: 'showing', on: true });
	expect(sent.filter((m) => (m as { type: string }).type === 'push')).toEqual([]);

	const dialog = await openSound(phone);
	const alert = dialog.getByRole('checkbox', { name: 'Alert while locked or closed' });
	const label = dialog.getByText('Alert while locked or closed', { exact: true });
	await expect(alert).not.toBeChecked();
	await label.tap();
	await expect(alert).toBeChecked();
	await expect
		.poll(() => sent.at(-1))
		.toMatchObject({ type: 'push', address: { endpoint: ENDPOINT } });

	await label.tap();
	await expect(alert).not.toBeChecked();
	await expect.poll(() => sent.at(-1)).toEqual({ type: 'push' });
	await phoneContext.close();
});

test('the alert is off and says why where notifications are blocked', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(Notification, 'permission', { get: () => 'denied' });
	});
	await page.goto('/');
	const dialog = await openSound(page);
	await expect(
		dialog.getByRole('checkbox', { name: 'Alert while locked or closed' })
	).toBeDisabled();
	await expect(
		dialog.getByText('Notifications are blocked for this app in the browser’s settings.')
	).toBeVisible();
});
