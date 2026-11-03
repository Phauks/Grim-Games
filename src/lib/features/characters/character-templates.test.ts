import { describe, expect, it } from 'vitest';
import { CHARACTER_TEMPLATES, resolveTemplate } from './character-templates.ts';

describe('character templates', () => {
	it('the name-only template is the row with its ability off', () => {
		expect(CHARACTER_TEMPLATES.name).toEqual({ ...CHARACTER_TEMPLATES.row, ability: false });
	});

	it('the entry is the badge across its space', () => {
		expect(CHARACTER_TEMPLATES.entry.shape).toBe(CHARACTER_TEMPLATES.badge.shape);
		expect(CHARACTER_TEMPLATES.entry.fullWidth).toBe(true);
	});

	it('a call site overrides a template part', () => {
		expect(resolveTemplate('row', { fullWidth: false })).toMatchObject({
			shape: 'ring',
			ability: true,
			fullWidth: false
		});
		expect(resolveTemplate('name', { ability: true }).ability).toBe(true);
	});

	it('a pill in a line of text never takes an ability', () => {
		expect(resolveTemplate('badge', { ability: true }).ability).toBe(false);
	});

	it('the icon template is the icon alone', () => {
		expect(resolveTemplate('icon', { ability: true, fullWidth: true })).toMatchObject({
			shape: 'icon',
			ability: false
		});
	});

	it('an entry takes its ability under the bar when asked', () => {
		expect(resolveTemplate('entry', {}).ability).toBe(false);
		expect(resolveTemplate('entry', { ability: true }).ability).toBe(true);
	});
});
