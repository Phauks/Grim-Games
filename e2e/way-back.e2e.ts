import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { expectWayBack } from './shell.ts';

// Every screen has a way back to where it came from (Trevor, 2026-10-26): the hamburger on the
// app's screens, a game screen's own Back or the start flow's Back bar. Checked on the phone
// and tablet, where no sidebar shows. A new route fails the first test until it is listed here.

/** A route under src/routes with a page, as SvelteKit writes it, e.g. `/towns/[groupId]/draw`. */
function routes(dir = 'src/routes'): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return routes(path);
		if (entry.name !== '+page.svelte') return [];
		return ['/' + relative('src/routes', dir).split(sep).join('/')].map((r) =>
			r === '/' ? r : r.replace(/\/$/, '')
		);
	});
}

/** Opened with made-up ids: each of these draws its page (and its hamburger) for any id. */
const ANY_ID: Record<string, string> = {
	'/campaigns/[campaignId]': '/campaigns/none',
	'/join/[code]': '/join/000000',
	'/live-games/[code]': '/live-games/000000',
	'/recap/[id]': '/recap/none',
	'/town/[code]': '/town/000000',
	'/towns/[groupId]': '/towns/none',
	'/towns/[groupId]/draw': '/towns/none/draw',
	'/towns/[groupId]/review': '/towns/none/review',
	// No viewer key in the link: the "bad link" message and its Home button.
	'/watch/[code]': '/watch/000000'
};

/** A game's screens, opened on a real game (the start flow's own Back needs one). */
const GAME = ['', '/deal', '/draw', '/extras', '/room', '/setup'];

/** Pages that are not screens: each opens another and is gone. */
const NOT_SCREENS: Record<string, string> = {
	'/diagnostics': 'opens About with Advanced open',
	'/settings': 'opens the Settings dialog over Home, which ✕ closes'
};

test('every route is checked for a way back', () => {
	const listed = new Set([
		...Object.keys(ANY_ID),
		...Object.keys(NOT_SCREENS),
		...GAME.map((path) => `/grimoire/[gameId]${path}`)
	]);
	const unlisted = routes().filter((r) => r.includes('[') && !listed.has(r));
	expect(unlisted, 'list each new route with parameters in way-back.e2e.ts').toEqual([]);
});

/** Routes with no parameters, each opened as it is. */
const plain = routes().filter((r) => !r.includes('[') && !NOT_SCREENS[r]);

for (const path of plain) {
	test(`${path} has a way back`, async ({ page }) => {
		await page.goto(path);
		await expectWayBack(page);
	});
}

for (const [route, path] of Object.entries(ANY_ID)) {
	test(`${route} has a way back`, async ({ page }) => {
		await page.goto(path);
		await expectWayBack(page);
	});
}

async function startGame(page: Page): Promise<string> {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Create game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+\/setup$/);
	return new URL(page.url()).pathname.replace(/\/setup$/, '');
}

test("a game's screens each have a way back", async ({ page }) => {
	const game = await startGame(page);
	// The browser's own "leave this page?" may ask as page.goto leaves a screen.
	page.on('dialog', (dialog) => void dialog.accept());
	for (const path of GAME) {
		await page.goto(game + path);
		await expectWayBack(page);
	}
});
