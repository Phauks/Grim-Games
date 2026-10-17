import { expect, test, type Page } from '@playwright/test';

// Trevor (2026-10-16): no horizontal scrolling on mobile. Every route, at the narrowest phone
// widths, with the smallest and the largest text, icon, token and reminder sizes.

const PREFS_KEY = 'grim-games:preferences:v1';
const WIDTHS = [320, 390];
const SIZES = [
	{ name: 'smallest text and icons', textScale: 0.75, iconScale: 0.75, tokenScale: 0.5 },
	{ name: 'largest text and icons', textScale: 1.5, iconScale: 1.5, tokenScale: 2 }
];
const STATIC_ROUTES = [
	'/',
	'/new',
	'/games',
	'/changelog',
	'/privacy',
	'/reference',
	'/scripts',
	'/settings',
	'/play',
	'/info-tokens',
	'/join',
	'/join/000001',
	'/spikes/badges',
	'/spikes/bluffs',
	'/spikes/day',
	'/spikes/icons',
	'/spikes/page',
	'/spikes/seat-sheet'
];

/**
 * Routes that still overflow, each waiting on the thread that owns it (2026-10-16). Remove a
 * route from this list when its fix lands; the guard then covers it like every other route.
 */
const KNOWN_OVERFLOW: Record<string, string> = {};

/** The widest elements poking past the right edge, to name in the failure. */
async function overflow(page: Page) {
	return page.evaluate(() => {
		const width = document.documentElement.clientWidth;
		const offenders = [...document.querySelectorAll('body *')]
			.map((el) => ({ el, right: el.getBoundingClientRect().right }))
			.filter(({ el, right }) => {
				if (right <= width + 1) return false;
				// Ignore content inside its own scroll box; only page-level overflow counts.
				for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
					const o = getComputedStyle(p).overflowX;
					if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return false;
				}
				return true;
			})
			.slice(0, 5)
			.map(({ el, right }) => {
				const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
				return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} right=${Math.round(right)}`;
			});
		// Tab lists must fit too: a row of tabs that scrolls inside its own box hides tabs.
		const tablists = [...document.querySelectorAll('[role="tablist"]')]
			.filter((el) => el.scrollWidth > el.clientWidth + 1)
			.map(
				(el) =>
					`tablist "${el.getAttribute('aria-label') ?? ''}" ${el.scrollWidth}px in ${el.clientWidth}px`
			);
		return { page: document.documentElement.scrollWidth, screen: width, offenders, tablists };
	});
}

async function startGame(page: Page): Promise<string> {
	await page.goto('/new');
	await page.getByRole('radiogroup', { name: 'Script' }).getByText('Trouble Brewing').tap();
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);
	return new URL(page.url()).pathname;
}

test.describe('no sideways scrolling on phones', () => {
	for (const width of WIDTHS) {
		for (const size of SIZES) {
			test(`${width}px, ${size.name}`, async ({ page }) => {
				test.skip(test.info().project.name !== 'phone', 'phone widths only');
				test.setTimeout(120_000);
				await page.setViewportSize({ width, height: 700 });
				await page.goto('/');
				await page.evaluate(
					([key, prefs]) => localStorage.setItem(key, prefs),
					[
						PREFS_KEY,
						JSON.stringify({
							textScale: size.textScale,
							iconScale: size.iconScale,
							tokenAppearance: {
								tokenScale: size.tokenScale,
								reminderScale: size.tokenScale,
								boardNames: true
							}
						})
					]
				);
				const game = await startGame(page);
				const routes: [string, string][] = [
					...STATIC_ROUTES.map((r): [string, string] => [r, r]),
					['board', game],
					['setup', `${game}/setup`],
					['draw', `${game}/draw`]
				];
				const failures: string[] = [];
				for (const [key, route] of routes) {
					if (key in KNOWN_OVERFLOW) continue;
					await page.goto(route);
					await page.waitForLoadState('networkidle');
					await page.evaluate(() => document.fonts.ready);
					const result = await overflow(page);
					if (result.page > result.screen)
						failures.push(
							`${route}: ${result.page}px wide on a ${result.screen}px screen (${result.offenders.join(', ')})`
						);
					for (const tablist of result.tablists) failures.push(`${route}: ${tablist}`);
				}
				expect(failures, failures.join('\n')).toEqual([]);
			});
		}
	}
});
