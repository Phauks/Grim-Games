import { expect, test, type Page } from '@playwright/test';
import { befriend, liveRoom, signedIn } from './friends.ts';
import { ENDPOINT, fakePush } from './push.ts';
import { openSettingsDialog } from './shell.ts';

// Push invites (plan F8; Trevor: friends features must not be spammy, so invites only, and off
// until turned on): "Notify me of game invites" on Friends keeps this device's push address on
// the account, and a friend's invite is pushed to it. The local server sends no push to a push
// service, so the test asks the account whether this device is on and when an invite was last
// pushed to it.

const LABEL = 'Notify me of game invites';

/** What the account says about this device's invite notifications. */
async function pushState(page: Page): Promise<{ on: boolean; pushedAt?: number }> {
	return page.evaluate(async (endpoint) => {
		const response = await fetch('/api/friends/push', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ endpoint })
		});
		return response.json();
	}, ENDPOINT);
}

test('invite notifications start off, and turning them on keeps this device on the account', async ({
	browser
}) => {
	test.slow();
	const bob = await signedIn(browser, 'bob');
	await fakePush(bob.page);
	await bob.page.goto('/friends');
	const toggle = bob.page.getByRole('checkbox', { name: LABEL });
	await expect(toggle).not.toBeChecked();
	await expect(toggle).toBeEnabled();
	expect(await pushState(bob.page)).toEqual({ on: false });

	await bob.page.getByText(LABEL, { exact: true }).tap();
	await expect(toggle).toBeChecked();
	await expect.poll(() => pushState(bob.page)).toEqual({ on: true });

	// The device's one subscription is shared, but Back to town alerts stay off (plan U12).
	await openSettingsDialog(bob.page);
	const settings = bob.page.getByRole('dialog', { name: 'Settings' });
	await settings
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: 'Sound' })
		.tap();
	await expect(
		settings.getByRole('checkbox', { name: 'Alert while locked or closed' })
	).not.toBeChecked();
	await bob.page.keyboard.press('Escape');

	// Opened again, the switch shows what the account keeps.
	await bob.page.reload();
	await expect(toggle).toBeChecked();

	await bob.page.getByText(LABEL, { exact: true }).tap();
	await expect(toggle).not.toBeChecked();
	await expect.poll(() => pushState(bob.page)).toEqual({ on: false });
});

test("a friend's invite is pushed to a device with invite notifications on", async ({
	browser
}) => {
	test.slow();
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');
	await fakePush(bob.page);
	await befriend(ann, bob);
	await bob.page.goto('/friends');
	await bob.page.getByText(LABEL, { exact: true }).tap();
	await expect(bob.page.getByRole('checkbox', { name: LABEL })).toBeChecked();
	await expect.poll(() => pushState(bob.page)).toEqual({ on: true });

	await liveRoom(ann.page);
	await ann.page.getByRole('button', { name: 'Invite friends' }).tap();
	const sheet = ann.page.getByRole('dialog', { name: 'Invite friends' });
	const row = sheet.getByTestId('invite-friends').getByRole('listitem').filter({
		hasText: bob.username
	});
	await row.getByRole('button', { name: 'Invite' }).tap();
	await expect(row.getByRole('button', { name: 'Invited' })).toBeDisabled();
	await expect.poll(async () => (await pushState(bob.page)).pushedAt).toBeGreaterThan(0);
});

test('invite notifications are off and disabled where the browser has no push', async ({
	browser
}) => {
	const bob = await signedIn(browser, 'bob');
	await bob.page.addInitScript(() => {
		delete (window as { PushManager?: unknown }).PushManager;
	});
	await bob.page.goto('/friends');
	const toggle = bob.page.getByRole('checkbox', { name: LABEL });
	await expect(toggle).toBeDisabled();
	await expect(toggle).not.toBeChecked();
});
