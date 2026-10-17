import { expect, test } from '@playwright/test';

test('a report sent from the footer reaches the inbox, where it can be triaged and deleted', async ({
	page
}) => {
	const title = `Enhancement ${Date.now()}`;
	await page.goto('/');
	await page.getByTestId('build-info').getByRole('button', { name: 'Report an issue' }).tap();
	const form = page.getByRole('dialog', { name: 'Report' });

	// Nothing is sent until Send, which waits for a title and a description.
	const send = form.getByRole('button', { name: 'Send' });
	await expect(send).toBeDisabled();
	await form.getByRole('combobox', { name: 'Kind' }).tap();
	await page.getByRole('option', { name: 'Enhancement request' }).tap();
	await form.getByRole('textbox', { name: 'Title' }).fill(title);
	await form.getByRole('textbox', { name: 'Description' }).fill('Show the night order on phones.');
	// What goes with it is listed before sending.
	await form.getByRole('button', { name: 'Sent with it' }).tap();
	await expect(form).toContainText('Build');
	expect((await send.boundingBox())!.height).toBeGreaterThanOrEqual(44);
	await send.tap();
	await expect(form.getByTestId('report-sent')).toHaveText(/^Sent as report #\d+\.$/);
	await form.getByRole('button', { name: 'Close' }).last().tap();

	// The inbox needs the admin key, kept on this device.
	await page.goto('/reports');
	// The title row's buttons and the filter are there before the key, disabled, so nothing moves.
	await expect(page.getByRole('button', { name: 'Refresh' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Forget key' })).toBeDisabled();
	const key = page.getByLabel('Admin key');
	await key.fill('wrong');
	await key.press('Enter');
	await expect(page.getByLabel('Wrong key')).toBeVisible();
	await page.getByLabel('Wrong key').fill('e2e-admin-key');
	await page.getByLabel('Wrong key').press('Enter');

	const row = page.getByTestId('reports').getByRole('button', { name: new RegExp(title) });
	await expect(row).toContainText('Enhancement request');
	await row.tap();
	const report = page.getByRole('dialog', { name: new RegExp(title) });
	await expect(report).toContainText('Show the night order on phones.');
	await report.getByRole('combobox', { name: 'Status' }).tap();
	await page.getByRole('option', { name: 'Accepted' }).tap();
	await report.getByRole('button', { name: 'Close' }).first().tap();
	// Filtered to New by default, so an accepted report leaves the list.
	await expect(row).toBeHidden();
	await page
		.getByRole('radiogroup', { name: 'Status' })
		.getByText('Accepted', { exact: true })
		.tap();
	await expect(row).toBeVisible();

	// The key is remembered; delete confirms first.
	await page.reload();
	await page.getByRole('radiogroup', { name: 'Status' }).getByText('All', { exact: true }).tap();
	await row.tap();
	await page.getByRole('button', { name: 'Delete report' }).tap();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' }).tap();
	await expect(row).toBeHidden();
});

test('reading reports without the key is refused', async ({ request }) => {
	expect((await request.get('/api/reports')).status()).toBe(404);
	const bad = await request.post('/api/reports', { data: { kind: 'spam', title: 'x', body: 'y' } });
	expect(bad.status()).toBe(400);
});
