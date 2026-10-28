import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from './character-rules.ts';
import { rulesOf } from './rules/index.ts';
import { Issues } from './validate.ts';

const parse = (raw: unknown, reminders?: string[]) => {
	const issues = new Issues();
	return { rules: parseCharacterRules(raw, 'rules', issues, reminders), issues: issues.list };
};

describe('choice and evil info rules', () => {
	it('reads every key', () => {
		const { rules, issues } = parse(
			{
				marksChoice: ['Chosen'],
				curses: 'Chosen',
				choosesLikeDemon: 'Chosen',
				choosesUnmarked: true,
				believesOtherCharacter: true,
				infoKind: { number: true },
				evilInfo: { notes: { demoninfo: 'a note' }, hidesDemon: true }
			},
			['Chosen']
		);
		expect(issues).toEqual([]);
		expect(rules).toEqual({
			marksChoice: ['Chosen'],
			curses: 'Chosen',
			choosesLikeDemon: 'Chosen',
			choosesUnmarked: true,
			believesOtherCharacter: true,
			infoKind: { number: true },
			evilInfo: { notes: { demoninfo: 'a note' }, hidesDemon: true }
		});
	});

	it('rejects reminders the character lacks and unknown fields', () => {
		expect(parse({ marksChoice: ['Safe'] }, ['Chosen']).issues).toEqual([
			'rules.marksChoice[0].label: not one of this character’s reminders'
		]);
		expect(parse({ curses: 'Safe' }, ['Chosen']).issues).toHaveLength(1);
		expect(parse({ infoKind: { twice: true } }).issues).toEqual([
			'rules.infoKind.twice: unknown field'
		]);
		expect(parse({ evilInfo: { notes: { dawn: 'x' } } }).issues).toEqual([
			'rules.evilInfo.notes.dawn: unknown field'
		]);
	});

	// https://wiki.bloodontheclocktower.com/Poppy_Grower and /Snitch: what each step must remember.
	it('holds the official notes and Savant facts in the rules files', () => {
		expect(rulesOf('poppygrower')?.evilInfo?.hidesDemon).toBe(true);
		expect(rulesOf('snitch')?.evilInfo?.notes?.minioninfo).toBeUndefined();
		expect(rulesOf('snitch')?.evilInfo?.notes?.demoninfo).toBeDefined();
		expect(rulesOf('monk')?.marksChoice).toEqual(['Safe']);
		expect(rulesOf('chef')?.infoKind).toEqual({ number: true });
		expect(rulesOf('artist')?.infoKind).toEqual({ oncePerGame: true });
		expect(rulesOf('lunatic')?.choosesLikeDemon).toBe('Chosen');
	});
});
