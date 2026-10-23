import { expect, test } from '@playwright/test';
import { theMenu } from './shell.ts';

// The page's own requests, so a route can play the server after a newer deploy.
test.use({ serviceWorkers: 'block' });

// 2026-10-23: a page left open on an older build asked for a code file the newest deploy no
// longer serves ("Failed to fetch dynamically imported module"), and the problems list filled
// up. Now the page loads afresh, on the build the server holds, and nothing is reported.
test("a page whose build's files are gone loads afresh instead of failing", async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

	// Until the next full page load, every page's code file is gone, as after a redeploy.
	let gone = true;
	let freshLoads = 0;
	page.on('request', (request) => {
		if (request.isNavigationRequest() && request.resourceType() === 'document') {
			gone = false;
			freshLoads++;
		}
	});
	await page.route('**/_app/immutable/nodes/**', (route) =>
		gone ? route.fulfill({ status: 404, body: '' }) : route.fallback()
	);

	await (await theMenu(page)).getByRole('link', { name: 'Character reference' }).tap();
	await expect(page).toHaveURL(/\/reference$/);
	await expect(page.getByRole('heading', { name: 'Character reference', level: 1 })).toBeVisible();
	expect(freshLoads).toBe(1);
	await expect(page.getByTestId('error-notice')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);
});
