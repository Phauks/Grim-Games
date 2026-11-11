/**
 * The `count` answer (M77): how many players of a group match, with the official one-off
 * questions kept as presets that expand to it.
 */
import { committedCharacters } from '#lib/core/testing/committed-data.ts';
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { Issues } from '#lib/core/data/validate.ts';

const read = (answers: unknown, reminders: string[] = []) => {
	const issues = new Issues();
	const rules = parseCharacterRules({ answers }, 'x', issues, reminders);
	return { answers: rules?.answers, issues: issues.list };
};

describe('count answers', () => {
	it('reads a count of a group, with or without an alignment', () => {
		expect(read({ question: 'count', among: 'dead', alignment: 'evil' })).toEqual({
			answers: { question: 'count', among: 'dead', alignment: 'evil' },
			issues: []
		});
		expect(read({ question: 'count', among: 'abnormal', token: 'Abnormal' }, ['Abnormal'])).toEqual(
			{ answers: { question: 'count', among: 'abnormal', token: 'Abnormal' }, issues: [] }
		);
	});

	it('expands the official names to the count they are', () => {
		expect(read({ question: 'evil-dead' }).answers).toEqual({
			question: 'count',
			among: 'dead',
			alignment: 'evil',
			preset: 'evil-dead'
		});
		expect(read({ question: 'abnormal-abilities' }).answers).toEqual({
			question: 'count',
			among: 'abnormal',
			preset: 'abnormal-abilities'
		});
	});

	it('refuses a count without a group, and a group on another question', () => {
		expect(read({ question: 'count' }).issues).toContainEqual(expect.stringContaining('among'));
		expect(read({ question: 'count', among: 'abnormal', alignment: 'evil' }).issues).not.toEqual(
			[]
		);
		expect(read({ question: 'evil-dead', among: 'dead' }).issues).not.toEqual([]);
	});

	it("writes the Mathematician's answer as a count of the abnormal", () => {
		expect(rulesOf('mathematician', committedCharacters())?.answers).toEqual({
			question: 'count',
			among: 'abnormal',
			token: 'Abnormal'
		});
	});
});
