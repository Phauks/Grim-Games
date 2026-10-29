import { expect, test, type Browser, type Page } from '@playwright/test';
import { theMenu } from './shell.ts';

// Friends (plan F1): two accounts, each in its own browser, find each other by username.
// Local runs use the preview email sender, so each sign-in code is shown on screen.

function unique(name: string): string {
	return `${name}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

/** A new account with a username, signed in on its own page. */
async function signedIn(browser: Browser, name: string): Promise<{ page: Page; username: string }> {
	const context = await browser.newContext(test.info().project.use);
	const page = await context.newPage();
	// Sign-in attempts are limited per network address; each account gets its own.
	const part = () => Math.floor(Math.random() * 254) + 1;
	await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `10.${part()}.${part()}.${part()}` });
	const email = `${unique(name)}@example.com`;
	await page.goto('/account');
	await page.getByLabel('Email address').fill(email);
	await page.getByRole('button', { name: 'Email me a code' }).tap();
	const code = (await page.getByTestId('preview-code').locator('strong').textContent()) ?? '';
	await page.getByLabel(`Code sent to ${email}`).fill(code);
	await page.getByRole('button', { name: 'Sign in' }).tap();
	const privacy = page.getByRole('alertdialog', { name: 'Privacy policy' });
	await privacy.getByText('I accept the Privacy policy', { exact: true }).tap();
	await privacy.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('account-email')).toHaveText(email);

	const username = unique(name);
	await page.getByRole('button', { name: 'Change username' }).tap();
	const naming = page.getByRole('dialog', { name: 'Change username' });
	await naming.getByLabel('Username').fill(username);
	await naming.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('account-username')).toHaveText(username);
	return { page, username };
}

/** Opens Friends from the menu's "You" group. */
async function openFriends(page: Page) {
	const nav = await theMenu(page);
	await nav.getByRole('link', { name: 'Friends' }).tap();
	await expect(page).toHaveURL(/\/friends$/);
	await expect(page.getByRole('heading', { name: 'Friends', level: 1 })).toBeVisible();
}

async function sendRequest(page: Page, username: string) {
	await page.getByRole('button', { name: 'Add friend' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Add friend' });
	await dialog.getByLabel('Their username').fill(username);
	await dialog.getByRole('button', { name: 'Send request' }).tap();
	return dialog;
}

test('signed out, Friends asks to sign in', async ({ page }) => {
	await page.goto('/');
	await openFriends(page);
	await expect(page.getByText('Sign in to add friends.')).toBeVisible();
	await page.getByRole('link', { name: 'Sign in' }).tap();
	await expect(page).toHaveURL(/\/account$/);
});

test('asking by username, accepting, and removing a friend', async ({ browser }) => {
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');

	await openFriends(ann.page);
	await expect(ann.page.getByTestId('friends-username')).toHaveText(ann.username);
	await expect(ann.page.getByTestId('friend-list-none')).toHaveText('None');

	// A name nobody holds, and Ann's own, are refused in the dialog.
	let dialog = await sendRequest(ann.page, unique('nobody'));
	await expect(dialog.getByRole('status')).toHaveText('No one can be found with that username.');
	await dialog.getByLabel('Their username').fill(ann.username);
	await dialog.getByRole('button', { name: 'Send request' }).tap();
	await expect(dialog.getByRole('status')).toHaveText('That’s your own username.');
	await dialog.getByRole('button', { name: 'Cancel' }).tap();

	// Usernames ignore case.
	dialog = await sendRequest(ann.page, bob.username.toUpperCase());
	await expect(dialog).toBeHidden();
	await expect(ann.page.getByTestId('friend-outgoing')).toContainText(bob.username);

	// Bob sees the request, counted beside Friends in the menu, and accepts it.
	await bob.page.goto('/');
	await expect((await theMenu(bob.page)).getByTestId('friend-requests-count')).toHaveText('1');
	await bob.page.goto('/friends');
	const incoming = bob.page.getByTestId('friend-incoming');
	await expect(incoming).toContainText(ann.username);
	await incoming.getByRole('button', { name: 'Accept' }).tap();
	await expect(bob.page.getByTestId('friend-list')).toContainText(ann.username);
	await expect(bob.page.getByTestId('friend-incoming-none')).toBeVisible();

	await ann.page.reload();
	await expect(ann.page.getByTestId('friend-list')).toContainText(bob.username);
	await expect(ann.page.getByTestId('friend-outgoing-none')).toBeVisible();

	// Removing ends it on both sides.
	await ann.page
		.getByTestId('friend-list')
		.getByRole('button', { name: `Actions for ${bob.username}` })
		.tap();
	await ann.page.getByRole('menuitem', { name: 'Remove friend' }).tap();
	await ann.page
		.getByRole('alertdialog', { name: `Remove ${bob.username}?` })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(ann.page.getByTestId('friend-list-none')).toBeVisible();
	await bob.page.reload();
	await expect(bob.page.getByTestId('friend-list-none')).toBeVisible();
});

test('a block is silent, and hiding from search stops new requests', async ({ browser }) => {
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');

	// Bob asks; Ann blocks him from the request.
	await bob.page.goto('/friends');
	await sendRequest(bob.page, ann.username);
	await expect(bob.page.getByTestId('friend-outgoing')).toContainText(ann.username);
	await ann.page.goto('/friends');
	const incoming = ann.page.getByTestId('friend-incoming');
	await incoming.getByRole('button', { name: `Actions for ${bob.username}` }).tap();
	await ann.page.getByRole('menuitem', { name: 'Block' }).tap();
	await ann.page
		.getByRole('alertdialog', { name: `Block ${bob.username}?` })
		.getByRole('button', { name: 'Confirm' })
		.tap();
	await expect(ann.page.getByTestId('friend-blocked')).toContainText(bob.username);
	await expect(ann.page.getByTestId('friend-incoming-none')).toBeVisible();

	// Bob is not told: asking again still reads as sent, and never reaches Ann.
	await bob.page
		.getByTestId('friend-outgoing')
		.getByRole('button', { name: 'Cancel request' })
		.tap();
	await sendRequest(bob.page, ann.username);
	await expect(bob.page.getByTestId('friend-outgoing')).toContainText(ann.username);
	await ann.page.reload();
	await expect(ann.page.getByTestId('friend-incoming-none')).toBeVisible();

	// Unblocked, then hidden from search: Bob can't find her by name.
	await ann.page.getByTestId('friend-blocked').getByRole('button', { name: 'Unblock' }).tap();
	await expect(ann.page.getByTestId('friend-blocked-none')).toBeVisible();
	const findable = ann.page.getByRole('checkbox', {
		name: 'Let people find me by username',
		includeHidden: true
	});
	await expect(findable).toBeChecked();
	await ann.page.getByText('Let people find me by username', { exact: true }).tap();
	await expect(findable).not.toBeChecked();
	await bob.page
		.getByTestId('friend-outgoing')
		.getByRole('button', { name: 'Cancel request' })
		.tap();
	const dialog = await sendRequest(bob.page, ann.username);
	await expect(dialog.getByRole('status')).toHaveText('No one can be found with that username.');
});
