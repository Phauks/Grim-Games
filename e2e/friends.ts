import { expect, test, type Browser, type Page } from '@playwright/test';
import { nameStoryteller, toBoard } from './new-game.ts';

// Friends' e2e helpers (plan F1): two accounts, each in its own browser. Local runs use the
// preview email sender, so each sign-in code is shown on screen.

export function unique(name: string): string {
	return `${name}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

/** A new account with a username, signed in on its own page. */
export async function signedIn(
	browser: Browser,
	name: string
): Promise<{ page: Page; username: string }> {
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

export async function sendRequest(page: Page, username: string) {
	await page.getByRole('button', { name: 'Add friend' }).tap();
	const dialog = page.getByRole('dialog', { name: 'Add friend' });
	await dialog.getByLabel('Username', { exact: true }).fill(username);
	await dialog.getByRole('button', { name: 'Send request' }).tap();
	return dialog;
}

/** Starts a Trouble Brewing game and opens its room; returns the board's path and the code. */
export async function liveRoom(
	page: Page,
	storyteller?: string
): Promise<{ board: string; code: string }> {
	await page.goto('/new');
	await page
		.getByRole('radiogroup', { name: 'Script' })
		.getByText('Trouble Brewing', { exact: true })
		.tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	await toBoard(page);
	if (storyteller) await nameStoryteller(page, storyteller);
	const board = new URL(page.url()).pathname;
	await page.goto(`${board}/room`);
	await expect(page.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible();
	const code = (await page.getByTestId('share-code').textContent())!.replace(/\s/g, '');
	return { board, code };
}

/** Ann asks Bob by username and Bob accepts. */
export async function befriend(ann: { page: Page }, bob: { page: Page; username: string }) {
	await ann.page.goto('/friends');
	await expect(ann.page.getByTestId('friend-list-none')).toBeVisible();
	await expect(await sendRequest(ann.page, bob.username)).toBeHidden();
	await bob.page.goto('/friends');
	await bob.page.getByTestId('friend-incoming').getByRole('button', { name: 'Accept' }).tap();
	await expect(bob.page.getByTestId('friend-list')).toBeVisible();
}
