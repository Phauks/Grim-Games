import { test } from '@playwright/test';
const combos = [
	{ id: 'text150', textScale: 1.5, iconScale: 1.5, tokenScale: 2, reminderScale: 2 },
	{ id: 'text75', textScale: 0.75, iconScale: 0.75, tokenScale: 0.5, reminderScale: 0.5 }
];
for (const c of combos) {
	test('dialog ' + c.id, async ({ page }, info) => {
		await page.addInitScript((c) => {
			localStorage.setItem('grim-games:preferences:v1', JSON.stringify({ textScale: c.textScale, iconScale: c.iconScale, tokenAppearance: { tokenScale: c.tokenScale, reminderScale: c.reminderScale, boardNames: true } }));
		}, c);
		await page.route('https://wiki.bloodontheclocktower.com/api.php?**', (route) =>
			route.fulfill({ json: { parse: { text: '<div class="mw-parser-output"><h2>Summary</h2><p>Sample summary paragraph for the page.</p><h2>How to Run</h2><p>Sample.</p><h2>Examples</h2><div class="example"><p>Sample example.</p></div></div>' } } })
		);
		await page.goto('/spikes/badges');
		await page.locator('button.badge', { hasText: 'Witch' }).first().tap();
		await page.waitForTimeout(800);
		await page.screenshot({ path: '/tmp/claude-0/-home-claude-Grim-Games/90757996-d475-549a-bc08-e588720e0e6b/scratchpad/sizes/dialog-' + c.id + '-' + info.project.name + '.png' });
	});
}
