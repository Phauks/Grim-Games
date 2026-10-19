import { expect, test } from '@playwright/test';
import { pickScript } from './new-game.ts';

// A script's own rules (`_meta.bootlegger`) show on the Bootlegger, and a new game starts with
// the script's Fabled and Loric in play (Trevor, 2026-10-18). The World Cup 2025 scripts carry
// their rule this way (https://botc-script-viewer.sthom.kiwi/wc25/); the rule below is made up.

const RULE = 'One seat stays empty and the Storyteller plays it.';

test("a script's rules show on the Bootlegger, and its Fabled and Loric start in play", async ({
	page
}) => {
	await page.goto('/library');
	await page.getByRole('button', { name: 'Add script' }).tap();
	const paste = page.getByRole('dialog', { name: 'Add script' });
	await paste
		.getByLabel('Script JSON')
		.fill(
			JSON.stringify([
				{ id: '_meta', name: 'Empty Chair', bootlegger: [RULE] },
				'chef',
				'empath',
				'imp',
				'ferryman'
			])
		);
	await paste.getByRole('button', { name: 'Confirm' }).tap();
	await expect(page.getByTestId('script-details-name')).toHaveText('Empty Chair');
	// The players' copy lists the Bootlegger with the rule, though the script doesn't list it.
	await expect(page.getByText(RULE)).toBeVisible();

	await page.goto('/new');
	await pickScript(page, 'Empty Chair');
	await page.getByRole('button', { name: 'Start game' }).tap();
	await expect(page).toHaveURL(/\/grimoire\/[\w-]+$/);

	const rules = page.getByRole('list', { name: 'Fabled and Loric' });
	await expect(rules.getByRole('button', { name: 'Ferryman' })).toBeVisible();
	const bootlegger = rules.getByRole('button', { name: 'Bootlegger' });
	await expect(bootlegger).toBeVisible();
	await bootlegger.tap();
	await expect(page.getByRole('dialog', { name: 'Bootlegger' })).toContainText(RULE);
});
