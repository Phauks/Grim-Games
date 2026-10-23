import { expect, test, type Locator, type Page } from '@playwright/test';
import { openSettingsDialog } from './shell.ts';

/**
 * Every setting beside a Settings preview shows in that preview (Trevor, 2026-10-22: "all
 * preview settings, shiould account for all previews in settings. lint for that? or make
 * sure there is a test"). For each group with a preview box, each of its controls is changed
 * in turn and the box's picture must change. A lint can't tell whether a setting draws
 * anything, so this looks at the pixels. A control that is disabled (its effect is off) is
 * skipped; a file picker can't be driven here.
 */

const SECTIONS = ['Board', 'Tokens'] as const;
/**
 * Settings that show only while another one is on, and also work outside the preview (so
 * they aren't disabled): the switch they need, turned on before they are measured.
 */
const NEEDS: Record<string, string> = {
	// Also the seat numbers, bag tiles and more; on the token it is the character's name.
	'Token text': 'Show character names on tokens'
};
/** Kinds of control a setting row holds, as their roles and inputs. */
const CONTROLS = [
	'input[type="checkbox"]',
	'input[type="range"]',
	'input[type="color"]',
	'[role="combobox"]',
	'[role="group"]:has(> button[aria-pressed])'
].join(', ');

async function openSection(page: Page, section: string) {
	await openSettingsDialog(page);
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await dialog
		.getByRole('navigation', { name: 'Settings sections' })
		.getByRole('button', { name: section })
		.tap();
	await expect(dialog.getByRole('heading', { name: section, level: 2 })).toBeVisible();
	return dialog;
}

/** The control's name as a person reads it, for the failure list. */
async function nameOf(control: Locator) {
	return control.evaluate((el) => {
		const labelled = el.getAttribute('aria-labelledby');
		const byId = labelled
			?.split(' ')
			.map((id) => document.getElementById(id)?.textContent?.trim())
			.find(Boolean);
		return (
			el.getAttribute('aria-label') ||
			byId ||
			(el as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
			el.textContent?.trim() ||
			el.outerHTML.slice(0, 60)
		);
	});
}

/**
 * Changes one control to another of its values. Returns how to put a switch or slider back,
 * so each later control is measured from the section's defaults.
 */
async function change(page: Page, control: Locator): Promise<(() => Promise<void>) | undefined> {
	const kind = await control.evaluate((el) =>
		el.matches('input') ? (el as HTMLInputElement).type : el.getAttribute('role') || 'group'
	);
	// The switch's input is visually hidden under its track: click it directly.
	if (kind === 'checkbox') {
		await control.dispatchEvent('click');
		return () => control.dispatchEvent('click');
	}
	if (kind === 'range') {
		const [value, min, max] = await control.evaluate((el: HTMLInputElement) => [
			el.value,
			el.min,
			el.max
		]);
		await control.fill(value === min ? max : min);
		return () => control.fill(value);
	}
	if (kind === 'color') {
		const value = await control.inputValue();
		await control.fill(value === '#123456' ? '#654321' : '#123456');
		return;
	}
	if (kind === 'combobox') {
		await control.tap();
		await page.locator('[role="option"]:not([aria-selected="true"]):visible').first().tap();
		// A choice that asks first (e.g. Reminders: Stay where dropped).
		const confirm = page.getByRole('alertdialog').getByRole('button', { name: 'Confirm' });
		if (await confirm.isVisible().catch(() => false)) await confirm.tap();
		return;
	}
	// A row of pressed buttons (e.g. the background choices): another one.
	await control.locator('button[aria-pressed="false"]').first().tap();
}

for (const section of SECTIONS) {
	test(`every ${section} setting beside a preview changes it`, async ({ page }) => {
		test.slow();
		await page.goto('/');
		const dialog = await openSection(page, section);
		await page.waitForLoadState('networkidle');
		const groups = dialog.locator('section.setting-group');
		const missing: string[] = [];
		for (let g = 0; g < (await groups.count()); g++) {
			const group = groups.nth(g);
			const box = group.locator('.box .body');
			const title = await group.locator('h3').first().innerText();
			const controls = group.locator('.settings').locator(CONTROLS);
			for (let c = 0; c < (await controls.count()); c++) {
				const control = controls.nth(c);
				if (await control.isDisabled()) continue;
				const name = await nameOf(control);
				await control.scrollIntoViewIfNeeded();
				const needs = NEEDS[name] && group.getByRole('checkbox', { name: NEEDS[name] });
				const switchOn = needs && !(await needs.isChecked());
				if (switchOn) await needs.dispatchEvent('click');
				const before = await box.screenshot({ animations: 'disabled' });
				const undo = await change(page, control);
				const changed = await expect
					.poll(async () => !(await box.screenshot({ animations: 'disabled' })).equals(before), {
						timeout: 3000
					})
					.toBe(true)
					.then(
						() => true,
						() => false
					);
				if (!changed) {
					missing.push(`${title}: ${name}`);
				}
				await undo?.();
				if (switchOn) await needs.dispatchEvent('click');
			}
		}
		expect(missing, 'settings that do not change their preview').toEqual([]);
	});
}
