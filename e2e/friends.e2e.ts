import { expect, test, type Browser, type Page } from '@playwright/test';
import { renderSVG } from 'uqr';
import { aimCamera, qrSrc } from './camera.ts';
import { nameStoryteller, toBoard } from './new-game.ts';
import { openProfile, setPlayerName } from './player-name.ts';
import { theMenu } from './shell.ts';
import { encodeSharedScript } from '../src/lib/features/scripts/share.ts';

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
	await dialog.getByLabel('Username', { exact: true }).fill(username);
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
	await dialog.getByLabel('Username', { exact: true }).fill(ann.username);
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

test('a friend code, scanned or opened, fills in Add friend', async ({ browser }) => {
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');

	// Ann's own code: a link with her username in the hash, her Profile avatar in the middle.
	await ann.page.goto('/friends');
	const link = ann.page.getByRole('textbox', { name: 'Link' });
	await expect(link).toHaveValue(new RegExp(`/friends#friend=${ann.username}$`));
	await expect(ann.page.getByRole('img', { name: 'QR code to add you as a friend' })).toBeVisible();
	// Its middle is her Profile's avatar, as Settings' Profile button shows it (2026-10-30).
	await expect(ann.page.getByTestId('profile-avatar')).toBeVisible();

	// Bob scans it from Add friend: her name is filled in, ready to send.
	await aimCamera(bob.page, qrSrc(renderSVG(await link.inputValue(), { border: 2 })));
	await bob.page.goto('/friends');
	await bob.page.getByRole('button', { name: 'Add friend' }).tap();
	const dialog = bob.page.getByRole('dialog', { name: 'Add friend' });
	await dialog.getByRole('button', { name: 'Scan a code' }).tap();
	await expect(dialog.getByLabel('Username', { exact: true })).toHaveValue(ann.username);
	await dialog.getByRole('button', { name: 'Send request' }).tap();
	await expect(bob.page.getByTestId('friend-outgoing')).toContainText(ann.username);

	// Opened as a link (the phone's own camera app), it opens Add friend the same way.
	await bob.page.goto(`/friends#friend=${ann.username}`);
	await expect(
		bob.page.getByRole('dialog', { name: 'Add friend' }).getByLabel('Username', { exact: true })
	).toHaveValue(ann.username);

	// Hidden from search, Ann has no code to show.
	await ann.page.getByText('Let people find me by username', { exact: true }).tap();
	await expect(ann.page.getByText('Finding you by username is off.')).toBeVisible();
});

/** Starts a Trouble Brewing game and opens its room; returns the board's path and the code. */
async function liveRoom(
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

/** Names a seat on the board, which seats the phone with that name. */
async function nameSeat(page: Page, number: number, name: string) {
	await page.getByRole('link', { name: 'Grimoire' }).tap();
	await page.getByRole('button', { name: new RegExp(`^Seat ${number}:`) }).tap();
	const sheet = page.locator('[data-scope="drawer"][data-part="content"]');
	await sheet.getByRole('button', { name: 'Edit player name' }).tap();
	await sheet.getByRole('textbox', { name: 'Player name' }).fill(name);
	await sheet.getByRole('textbox', { name: 'Player name' }).press('Enter');
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
}

test('a player in a live game is added from their profile', async ({ browser }) => {
	// Plan F2 (Trevor, 2026-10-29): a signed-in player's account is always linked to the room;
	// no phone ever learns another's account, only whether Add friend can be offered.
	test.slow();
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');
	const { board, code } = await liveRoom(ann.page);

	await bob.page.goto(`/join/${code}`);
	await openProfile(bob.page);
	await setPlayerName(bob.page, 'Bob');
	await bob.page.keyboard.press('Escape');
	await expect(ann.page.getByTestId('status-players')).toHaveText('1 player');
	await nameSeat(ann.page, 3, 'Bob');
	await expect(bob.page.getByTestId('you-row')).toHaveAttribute('data-seat', '3');

	// The Storyteller opens Bob's profile from Players and asks him.
	await ann.page.goto(`${board}/players`);
	await ann.page
		.getByRole('list', { name: 'Players in the room' })
		.getByRole('listitem')
		.filter({ hasText: 'Bob' })
		.getByTestId('sheet-avatar')
		.tap();
	const profile = ann.page.getByRole('dialog', { name: 'Bob', exact: true });
	const add = profile.getByTestId('seat-friend');
	await expect(add).toHaveAttribute('data-state', 'add');
	await expect(add).toHaveAccessibleName('Add friend');
	await add.tap();
	await expect(add).toHaveAttribute('data-state', 'requested');
	await expect(add).toHaveAccessibleName('Requested');
	await expect(add).toBeDisabled();

	// Bob's own seat says it is him, and the request waits on his Friends page.
	await bob.page.getByRole('tab', { name: 'Grim' }).tap();
	await bob.page.getByTestId('grim-seat').nth(2).tap();
	await bob.page.getByRole('dialog', { name: 'Seat 3 · Bob' }).getByTestId('sheet-avatar').tap();
	const own = bob.page.getByRole('dialog', { name: 'Bob', exact: true }).getByTestId('seat-friend');
	await expect(own).toHaveAttribute('data-state', 'self');
	await expect(own).toHaveAccessibleName('You');
	await bob.page.goto('/friends');
	await expect(bob.page.getByTestId('friend-incoming')).toContainText(ann.username);
});

test('a player adds the Storyteller from Game info', async ({ browser }) => {
	// Trevor, 2026-10-30: players open Game info from their grim's corner, and the Storyteller's
	// name there opens their profile, with Add friend.
	test.slow();
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');
	// Ann's Profile laurel, which the room shares as a player's (Trevor, 2026-10-30).
	await ann.page.evaluate(() => {
		const key = 'grim-games:player-settings:v1';
		const settings = JSON.parse(localStorage.getItem(key) ?? '{}');
		localStorage.setItem(key, JSON.stringify({ ...settings, frame: 'ring-gold~pulse' }));
	});
	const { code } = await liveRoom(ann.page, 'Ann the Storyteller');
	await bob.page.goto(`/join/${code}`);
	await openProfile(bob.page);
	await setPlayerName(bob.page, 'Bob');
	await bob.page.keyboard.press('Escape');

	await bob.page.getByRole('tab', { name: 'Grim' }).tap();
	// From the grim's top right: a phone's corner often has no room for the script's name.
	await bob.page.getByTestId('grim-game-info').tap();
	const info = bob.page.getByRole('dialog', { name: 'Game info', exact: true });
	await expect(info.getByTestId('game-info')).toContainText('Trouble Brewing');
	await info.getByTestId('info-storyteller').tap();
	await expect(info).toBeHidden();
	const profile = bob.page.getByRole('dialog', { name: 'Ann the Storyteller', exact: true });
	// Her laurel, as a player's profile shows theirs.
	await expect(profile.locator('svg[data-frame="ring-gold~pulse"]')).toBeAttached();
	await expect(profile).not.toContainText('None');
	const add = profile.getByTestId('seat-friend');
	await expect(add).toHaveAttribute('data-state', 'add');
	await add.tap();
	await expect(add).toHaveAttribute('data-state', 'requested');

	await ann.page.goto('/friends');
	await expect(ann.page.getByTestId('friend-incoming')).toContainText(bob.username);
});

test("a player opens the Storyteller's profile from the name at the top", async ({ browser }) => {
	// Trevor, 2026-10-31: "allow players to click storyteller name in player view, in the top
	// where it says storyteller, to access that profile".
	test.slow();
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');
	await ann.page.evaluate(() => {
		const key = 'grim-games:player-settings:v1';
		const settings = JSON.parse(localStorage.getItem(key) ?? '{}');
		localStorage.setItem(key, JSON.stringify({ ...settings, frame: 'ring-gold~pulse' }));
	});
	const { code } = await liveRoom(ann.page, 'Ann the Storyteller');
	await bob.page.goto(`/join/${code}`);
	await openProfile(bob.page);
	await setPlayerName(bob.page, 'Bob');
	await bob.page.keyboard.press('Escape');

	const name = bob.page.getByTestId('byline-storyteller');
	await expect(name).toHaveText('Ann the Storyteller');
	await name.tap();
	const profile = bob.page.getByRole('dialog', { name: 'Ann the Storyteller', exact: true });
	await expect(profile.locator('svg[data-frame="ring-gold~pulse"]')).toBeAttached();
	const add = profile.getByTestId('seat-friend');
	await expect(add).toHaveAttribute('data-state', 'add');
	await add.tap();
	await expect(add).toHaveAttribute('data-state', 'requested');
});

test('people from a finished game are on Recent players, with Add friend', async ({ browser }) => {
	// Plan F3: when a game ends, its signed-in Storyteller and seated players remember each
	// other, and each can ask from their Friends page.
	test.slow();
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');
	const { board, code } = await liveRoom(ann.page, 'Ann the Storyteller');
	await bob.page.goto(`/join/${code}`);
	await openProfile(bob.page);
	await setPlayerName(bob.page, 'Bob');
	await bob.page.keyboard.press('Escape');
	await expect(ann.page.getByTestId('status-players')).toHaveText('1 player');
	await nameSeat(ann.page, 3, 'Bob');
	await expect(bob.page.getByTestId('you-row')).toHaveAttribute('data-seat', '3');

	// Nobody is there until the game is over.
	await bob.page.goto('/friends');
	await expect(bob.page.getByTestId('friend-recent-none')).toBeVisible();

	await ann.page.goto(board);
	await ann.page.getByRole('button', { name: 'More', exact: true }).tap();
	await ann.page
		.getByRole('dialog', { name: 'Grimoire' })
		.getByRole('button', { name: 'End game', exact: true })
		.tap();
	const end = ann.page.getByRole('alertdialog', { name: 'End game?' });
	await end.getByRole('button', { name: 'Confirm', exact: true }).tap();
	await expect(ann.page.getByTestId('game-over')).toBeVisible();

	// Bob sees Ann, by her username, as she was called in the game.
	await expect(async () => {
		await bob.page.reload();
		await expect(bob.page.getByTestId('friend-recent')).toContainText(ann.username, {
			timeout: 2000
		});
	}).toPass();
	const row = bob.page.getByTestId('friend-recent').getByRole('listitem');
	await expect(row.getByTestId('player-badge')).toHaveText('Ann the Storyteller');
	await expect(row).toContainText('Games together: 1');
	const add = row.getByTestId('seat-friend');
	await expect(add).toHaveAttribute('data-state', 'add');
	await add.tap();
	await expect(add).toHaveAttribute('data-state', 'requested');

	// Ann has Bob on hers, and his request waiting.
	await ann.page.goto('/friends');
	await expect(ann.page.getByTestId('friend-incoming')).toContainText(bob.username);
	await expect(ann.page.getByTestId('friend-recent')).toContainText(bob.username);
	await expect(ann.page.getByTestId('friend-recent').getByTestId('player-badge')).toHaveText('Bob');

	// The game counts on both profiles, which anyone can open (plan F11).
	await ann.page.goto(`/u/${bob.username}`);
	await expect(ann.page.getByTestId('profile-games')).toHaveText('Games played: 1');
});

test('the Storyteller invites a friend, who joins from Friends', async ({ browser }) => {
	// Plan F4: Invite friends on the room's Share; the invite waits on the friend's Friends
	// page with Join, and the sidebar counts it.
	test.slow();
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');
	await befriend(ann, bob);
	const { code } = await liveRoom(ann.page);

	await ann.page.getByRole('button', { name: 'Invite friends' }).tap();
	const sheet = ann.page.getByRole('dialog', { name: 'Invite friends' });
	const row = sheet.getByTestId('invite-friends').getByRole('listitem').filter({
		hasText: bob.username
	});
	await row.getByRole('button', { name: 'Invite' }).tap();
	await expect(row.getByRole('button', { name: 'Invited' })).toBeDisabled();
	await sheet.getByRole('button', { name: 'Close' }).tap();

	// Counted beside Friends in Bob's menu, as a request is.
	await bob.page.goto('/');
	await expect((await theMenu(bob.page)).getByTestId('friend-requests-count')).toHaveText('1');
	await bob.page.goto('/friends');
	const invite = bob.page.getByTestId('friend-invites').getByRole('listitem');
	await expect(invite).toContainText('Trouble Brewing');
	await expect(invite).toContainText(`From ${ann.username}`);
	await invite.getByRole('link', { name: 'Join' }).tap();
	await expect(bob.page).toHaveURL(new RegExp(`/join#${code}$`));
	await expect(bob.page.getByTestId('room-preview')).toContainText('Trouble Brewing');
	await bob.page.getByRole('button', { name: 'Join as player' }).tap();
	await openProfile(bob.page);
	await setPlayerName(bob.page, 'Bob');
	await bob.page.keyboard.press('Escape');
	await expect(ann.page.getByTestId('status-players')).toHaveText('1 player');

	// Bob is in the room now, and the sheet says so.
	await ann.page.getByRole('button', { name: 'Invite friends' }).tap();
	await expect(row.getByRole('button', { name: 'In the room' })).toBeDisabled();
	await sheet.getByRole('button', { name: 'Close' }).tap();

	// Declined, it goes.
	await bob.page.goto('/friends');
	await bob.page.getByTestId('friend-invites').getByRole('button', { name: 'Decline' }).tap();
	await expect(bob.page.getByTestId('friend-invites-none')).toBeVisible();
});

test("friends see each other's presence, and join a game its Storyteller opened to friends", async ({
	browser
}) => {
	// Plan F5 (Trevor approved presence with a switch, and joining without an invite only when
	// the Storyteller allows it per room, 2026-10-28).
	test.slow();
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');
	await befriend(ann, bob);
	const annRow = bob.page.getByTestId('friend-list').getByRole('listitem');
	await expect(annRow.getByTestId('friend-presence')).toHaveText('Last seen this hour');

	const { code } = await liveRoom(ann.page);
	await expect(async () => {
		await bob.page.reload();
		await expect(annRow.getByTestId('friend-presence')).toHaveText('In a game', {
			timeout: 2000
		});
	}).toPass();
	await expect(annRow.getByRole('link', { name: 'Join' })).toHaveCount(0);

	// Ann opens her room to friends; Bob's row offers Join.
	await ann.page.getByText('Friends can join without an invite', { exact: true }).tap();
	await expect(async () => {
		await bob.page.reload();
		await expect(annRow.getByRole('link', { name: 'Join' })).toBeVisible({ timeout: 2000 });
	}).toPass();
	await annRow.getByRole('link', { name: 'Join' }).tap();
	await expect(bob.page).toHaveURL(new RegExp(`/join#${code}$`));
	await expect(bob.page.getByTestId('room-preview')).toContainText('Trouble Brewing');

	// Ann hides her presence: Bob sees none of it.
	await ann.page.goto('/friends');
	await ann.page.getByText('Let friends see when I’m on', { exact: true }).tap();
	await bob.page.goto('/friends');
	await expect(annRow).toContainText(ann.username);
	await expect(annRow.getByTestId('friend-presence')).toHaveCount(0);
	await expect(annRow.getByRole('link', { name: 'Join' })).toHaveCount(0);
});

// Trevor, 2026-10-31: several groups, each with a join code, for a board game cafe; members
// look at the group when a game starts, and nobody is sent anything (plan F6).
test('a group by join code shows the games its Storytellers put in it', async ({ browser }) => {
	test.slow();
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');

	// Ann starts the group; its sheet opens with the code to share.
	await ann.page.goto('/friends');
	await ann.page.getByRole('button', { name: 'Add a group' }).tap();
	await ann.page.getByRole('menuitem', { name: 'New group' }).tap();
	const form = ann.page.getByRole('dialog', { name: 'New group' });
	await form.getByLabel('Name').fill('Board Game Cafe');
	await form.getByRole('button', { name: 'Create' }).tap();
	const annSheet = ann.page.getByRole('dialog', { name: 'Board Game Cafe' });
	const shown = annSheet.getByTestId('share-code');
	await expect(shown).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
	const code = (await shown.textContent())!;
	await annSheet.getByRole('button', { name: 'Close' }).tap();

	// Bob joins with the code, typed in lower case.
	await bob.page.goto('/friends');
	await bob.page.getByRole('button', { name: 'Add a group' }).tap();
	await bob.page.getByRole('menuitem', { name: 'Join a group' }).tap();
	const join = bob.page.getByRole('dialog', { name: 'Join a group' });
	await join.getByLabel('Join code').fill(code.toLowerCase());
	await join.getByRole('button', { name: 'Join' }).tap();
	const bobSheet = bob.page.getByRole('dialog', { name: 'Board Game Cafe' });
	await expect(bobSheet.getByTestId('group-games-none')).toBeVisible();
	await expect(bobSheet).toContainText('Members: 2');
	await bobSheet.getByRole('button', { name: 'Close' }).tap();
	const bobRow = bob.page.getByTestId('friend-groups').getByRole('listitem');
	await expect(bobRow).toContainText('Games now: 0');

	// Ann's game shows in the group only once she turns it on.
	const { code: room } = await liveRoom(ann.page);
	await ann.page.getByText('Show in Board Game Cafe', { exact: true }).tap();
	await expect(ann.page.getByRole('checkbox', { name: 'Show in Board Game Cafe' })).toBeChecked();
	await expect(async () => {
		await bob.page.reload();
		await expect(bobRow).toContainText('Games now: 1', { timeout: 2000 });
	}).toPass();
	await bobRow.getByRole('button', { name: 'Open' }).tap();
	const game = bobSheet.getByTestId('group-games').getByRole('listitem');
	await expect(game).toContainText(`Storyteller: ${ann.username}`);
	await game.getByRole('link', { name: 'Join' }).tap();
	await expect(bob.page).toHaveURL(new RegExp(`/join#${room}$`));

	// Join game lists it under the code too, with the group's name.
	await bob.page.goto('/join');
	const listed = bob.page.getByTestId('join-group-games').getByRole('listitem');
	await expect(listed).toContainText('Board Game Cafe');
	await listed.getByRole('button', { name: 'Join' }).tap();
	await expect(bob.page).toHaveURL(new RegExp(`/join/${room}$`));

	// Ann sees the members and removes Bob, whose list then has no group.
	await ann.page.goto('/friends');
	await ann.page.getByTestId('friend-groups').getByRole('button', { name: 'Open' }).tap();
	const members = annSheet.getByTestId('group-members').getByRole('listitem');
	await expect(members).toHaveCount(2);
	await annSheet.getByRole('button', { name: `Remove ${bob.username} from the group` }).tap();
	await expect(members).toHaveCount(1);
	await bob.page.goto('/friends');
	await expect(bob.page.getByTestId('friend-groups-none')).toBeVisible();
});

/** Ann asks Bob by username and Bob accepts. */
async function befriend(ann: { page: Page }, bob: { page: Page; username: string }) {
	await ann.page.goto('/friends');
	await expect(ann.page.getByTestId('friend-list-none')).toBeVisible();
	await expect(await sendRequest(ann.page, bob.username)).toBeHidden();
	await bob.page.goto('/friends');
	await bob.page.getByTestId('friend-incoming').getByRole('button', { name: 'Accept' }).tap();
	await expect(bob.page.getByTestId('friend-list')).toBeVisible();
}

// Trevor, 2026-10-30: "hey, use this script to a friend. Or instead of having to login, they
// can just point at their profile" (plan F9, F10).
test('a script sent to a friend, and one shown on a profile anyone can open', async ({
	browser
}) => {
	// Two sign-ups, a friendship, then the script both ways and a stranger's view: about 16 s
	// alone, past the 30 s default beside other tests, as the other two-account tests are.
	test.slow();
	const ann = await signedIn(browser, 'ann');
	const bob = await signedIn(browser, 'bob');
	await befriend(ann, bob);

	const script = [{ id: '_meta', name: 'Friend Night', author: 'Ann' }, 'chef', 'empath', 'imp'];
	await ann.page.goto(`/play#s=${await encodeSharedScript(script)}`);
	await expect(ann.page.getByRole('heading', { name: 'Friend Night', level: 1 })).toBeVisible();
	await ann.page.getByRole('button', { name: 'Share script' }).tap();
	const share = ann.page.getByRole('dialog', { name: 'Share', exact: true });
	await share.getByRole('button', { name: 'Send to a friend' }).tap();
	const choose = ann.page.getByRole('dialog', { name: 'Send to a friend' });
	const row = choose.getByTestId('send-script-friends').getByRole('listitem');
	await expect(row).toContainText(bob.username);
	await row.getByRole('button', { name: 'Send' }).tap();
	await expect(row.getByRole('button', { name: 'Sent' })).toBeDisabled();
	await choose.getByRole('button', { name: 'Close' }).tap();
	const publish = share.getByRole('checkbox', { name: 'Show on my profile' });
	await expect(publish).toBeEnabled();
	await share.getByText('Show on my profile', { exact: true }).tap();
	await expect(publish).toBeChecked();

	// Bob finds it under Scripts from friends; Open loads it into his Library.
	await bob.page.reload();
	const inbox = bob.page.getByTestId('friend-scripts');
	await expect(inbox).toContainText('Friend Night');
	await expect(inbox).toContainText(`From ${ann.username}`);
	await inbox.getByRole('link', { name: 'Open' }).tap();
	await expect(bob.page).toHaveURL(/\/scripts$/);
	// Search shows it once saved; leaving sooner would drop the save.
	await expect(bob.page.getByText('Friend Night').first()).toBeVisible();
	await bob.page.goto('/library');
	await expect(bob.page.getByText('Friend Night').first()).toBeVisible();
	await bob.page.goto('/friends');
	await bob.page.getByTestId('friend-scripts').getByRole('button', { name: 'Dismiss' }).tap();
	await expect(bob.page.getByTestId('friend-scripts-none')).toBeVisible();

	// Tapping a friend opens their profile, with the scripts they show there.
	await bob.page.getByTestId('friend-list').getByRole('link', { name: ann.username }).tap();
	await expect(bob.page).toHaveURL(new RegExp(`/u/${ann.username}$`));
	await expect(bob.page.getByRole('heading', { name: ann.username, level: 1 })).toBeVisible();
	await expect(bob.page.getByTestId('profile-page-scripts')).toContainText('Friend Night');
	await expect(bob.page.getByRole('button', { name: 'Add friend' })).toBeDisabled();

	// Signed out, the same link opens it, with no Add friend.
	const stranger = await (await browser.newContext(test.info().project.use)).newPage();
	await stranger.goto(`/u/${ann.username.toUpperCase()}`);
	const scripts = stranger.getByTestId('profile-page-scripts');
	await expect(scripts).toContainText('Friend Night');
	await expect(stranger.getByRole('button', { name: 'Add friend' })).toHaveCount(0);
	await scripts.getByRole('link', { name: 'Open' }).tap();
	await expect(stranger).toHaveURL(/\/scripts$/);

	// Published means public (Trevor, 2026-10-30): hiding from search leaves the profile open.
	await ann.page.goto('/friends');
	await ann.page.getByText('Let people find me by username', { exact: true }).tap();
	await expect(
		ann.page.getByRole('checkbox', { name: 'Let people find me by username', includeHidden: true })
	).not.toBeChecked();
	await stranger.goto(`/u/${ann.username}`);
	await expect(stranger.getByTestId('profile-page-scripts')).toContainText('Friend Night');

	// Ann takes it off her profile on the Friends page.
	await ann.page
		.getByTestId('profile-scripts')
		.getByRole('button', { name: 'Remove Friend Night from your profile' })
		.tap();
	await expect(ann.page.getByTestId('profile-scripts-none')).toBeVisible();
	await stranger.goto(`/u/${ann.username}`);
	await expect(stranger.getByTestId('profile-page-scripts-none')).toBeVisible();
	await stranger.goto(`/u/${unique('nobody')}`);
	await expect(stranger.getByRole('status')).toHaveText('No one can be found with that username.');
});
