import { expect, test, type Page } from '@playwright/test';
import { signIn } from './admin.ts';
import { theMenu } from './shell.ts';
import type { ReportList } from '../src/lib/features/reports/reports-protocol.ts';

async function openReportForm(page: Page) {
	await (await theMenu(page)).getByRole('button', { name: 'Report an issue' }).tap();
	const form = page.getByRole('dialog', { name: 'Report' });
	await expect(form).toBeVisible();
	return form;
}

test('a report filed offline is kept through a restart and sent once when back online', async ({
	page,
	context
}) => {
	// Trevor, 2026-10-27: "bug reports can be submitted offline, and will truly submit when
	// back on network". Signed in, so the stored reports can be counted afterwards.
	const title = `Offline ${Date.now()}`;
	await signIn(page, `offline-${Date.now()}@example.com`);
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

	let form = await openReportForm(page);
	await form.getByRole('textbox', { name: 'Title' }).fill(title);
	await form.getByRole('textbox', { name: 'Description' }).fill('Filed with no signal.');
	await context.setOffline(true);
	await form.getByRole('button', { name: 'Confirm' }).tap();
	await expect(form.getByTestId('report-waiting')).toBeVisible();

	// The app is closed and opened again, still offline: the report is still waiting.
	await page.close();
	page = await context.newPage();
	await page.goto('/');
	form = await openReportForm(page);
	const outbox = form.getByTestId('report-outbox');
	const entry = outbox.locator('li', { hasText: title });
	await expect(entry).toContainText('Waiting to send');

	// Back online, the first send reaches the Worker but its answer is lost on the way back.
	let dropped!: () => void;
	const answerDropped = new Promise<void>((resolve) => (dropped = resolve));
	await page.route(
		'**/api/reports',
		async (route) => {
			await route.fetch();
			await route.abort('connectionreset');
			dropped();
		},
		{ times: 1 }
	);
	await context.setOffline(false);
	await answerDropped;
	await expect(entry).toContainText('Waiting to send');

	// Tried again when the connection returns: sent, and stored once.
	await context.setOffline(true);
	await context.setOffline(false);
	await expect(entry).toContainText(/Sent as #\d+/);
	const list = (await (await page.request.get('/api/reports')).json()) as ReportList;
	expect(list.reports.filter((report) => report.title === title)).toHaveLength(1);
	await expect(entry).toContainText(`#${list.reports.find((r) => r.title === title)!.id}`);
});
