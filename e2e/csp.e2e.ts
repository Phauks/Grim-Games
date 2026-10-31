import { expect, test, type Page } from '@playwright/test';
import { pickScript, toBoard } from './new-game.ts';

/**
 * The Content Security Policy (vite.config.ts) blocks nothing the app itself loads: every
 * violation on these screens fails the test, naming the directive and what was blocked.
 */
async function watchViolations(page: Page): Promise<string[]> {
	const blocked: string[] = [];
	await page.exposeFunction('reportCspViolation', (line: string) => blocked.push(line));
	await page.addInitScript(() => {
		addEventListener('securitypolicyviolation', (event) => {
			const report = (window as unknown as { reportCspViolation(line: string): void })
				.reportCspViolation;
			report(`${event.effectiveDirective} ${event.blockedURI || 'inline'} on ${location.pathname}`);
		});
	});
	return blocked;
}

test('pages carry the Content Security Policy and nothing on them is blocked', async ({ page }) => {
	const blocked = await watchViolations(page);
	await page.goto('/');
	const policy = await page
		.locator('meta[http-equiv="content-security-policy"]')
		.getAttribute('content');
	expect(policy).toContain("script-src 'self' 'sha256-");
	expect(policy).toContain("object-src 'none'");
	for (const path of ['/new', '/play#e=tb', '/scripts', '/reference', '/library', '/about']) {
		await page.goto(path);
		await expect(page.locator('main')).not.toBeEmpty();
	}
	// The board: character tokens, the reminder bank and the backdrop.
	await page.goto('/new');
	await pickScript(page, 'Trouble Brewing');
	await page.getByRole('button', { name: 'Create game' }).tap();
	await toBoard(page);
	expect(blocked).toEqual([]);
});
