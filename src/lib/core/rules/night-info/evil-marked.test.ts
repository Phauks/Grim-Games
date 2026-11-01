/**
 * The `evil-marked` answer and `wakes: 'marked'` (M15f): a rule character whose players are
 * the ones it marks (the Duchess's visitors, https://wiki.bloodontheclocktower.com/Duchess).
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { answerOptions } from './answers.ts';
import { characterStepSeats, nightStepInfo, wakesMarked } from './steps.ts';
import type { NightAnswer } from './reliability.ts';

/** The Duchess's answers tonight, by waking seat. */
function duchessAnswers(s: ReturnType<typeof scenario>): Map<string, NightAnswer> {
	const info = nightStepInfo(
		s.game,
		{ id: 'duchess' },
		s.characters,
		undefined,
		undefined,
		'other'
	);
	expect(info?.kind).toBe('answer');
	const answers = info?.kind === 'answer' ? info.answers : [];
	return new Map(answers.map((a) => [a.seatId, a]));
}

describe('evil-marked answers (Duchess)', () => {
	const base = () => scenario(['soldier', 'pacifist', 'sage', 'po', 'mutant']).rule('duchess');

	it('wakes nobody while nobody is marked', () => {
		const s = base();
		expect(wakesMarked('duchess', s.characters)).toBe(true);
		expect(characterStepSeats(s.game, 'duchess', s.characters)).toEqual([]);
		expect(nightStepInfo(s.game, { id: 'duchess' }, s.characters)).toBeUndefined();
	});

	it('gives each visitor the evil count among visitors, themself included', () => {
		const s = base()
			.reminder('mutant', 'duchess', 'Visitor')
			.reminder('pacifist', 'duchess', 'Visitor')
			.reminder('po', 'duchess', 'False Info');
		expect(characterStepSeats(s.game, 'duchess', s.characters)).toEqual([
			s.seat('pacifist'),
			s.seat('po'),
			s.seat('mutant')
		]);
		const answers = duchessAnswers(s);
		for (const seat of ['pacifist', 'po', 'mutant'] as const) {
			const a = answers.get(s.seat(seat));
			expect(a?.kind === 'number' && a.value).toBe(1);
			expect(a?.because).toEqual([s.seat('po')]);
		}
	});

	it('marks the False Info visitor: the true count must not be given', () => {
		const s = base()
			.reminder('soldier', 'duchess', 'Visitor')
			.reminder('pacifist', 'duchess', 'Visitor')
			.reminder('sage', 'duchess', 'False Info');
		const answers = duchessAnswers(s);
		expect(answers.get(s.seat('soldier'))?.mustBeFalse).toBeUndefined();
		const sage = answers.get(s.seat('sage'))!;
		expect(sage.mustBeFalse).toBe(true);
		expect(sage.falseBy).toBe('duchess');
		const options = answerOptions(s.game, sage, s.characters);
		expect(options[0]).toEqual({ reason: 'invalid', value: { kind: 'number', value: 0 } });
		expect(options.slice(1).map((o) => o.value)).toEqual([
			{ kind: 'number', value: 1 },
			{ kind: 'number', value: 2 },
			{ kind: 'number', value: 3 }
		]);
	});

	it('reads wakes and falseToken, and refuses a token the character lacks', () => {
		const issues = new Issues();
		const ok = parseCharacterRules(
			{ answers: { question: 'evil-marked', wakes: 'marked', falseToken: 'False Info' } },
			'x',
			issues,
			['Visitor', 'False Info']
		);
		expect(issues.list).toEqual([]);
		expect(ok?.answers).toEqual({
			question: 'evil-marked',
			wakes: 'marked',
			falseToken: 'False Info'
		});
		const bad = new Issues();
		parseCharacterRules({ answers: { question: 'evil-marked', falseToken: 'Nope' } }, 'x', bad, [
			'Visitor'
		]);
		expect(bad.list.length).toBeGreaterThan(0);
	});
});

describe('Duchess wiki examples, worked by the engine (M15f)', () => {
	// The ability test file holds the verbatim examples; these check the numbers the app gives.
	it('Example 1: no evil visitors, so the False Info visitor is told anything but 0', () => {
		const s = scenario(['soldier', 'pacifist', 'sage', 'imp', 'baron'])
			.rule('duchess')
			.reminder('soldier', 'duchess', 'Visitor')
			.reminder('pacifist', 'duchess', 'Visitor')
			.reminder('sage', 'duchess', 'False Info');
		const answers = duchessAnswers(s);
		expect(answers.get(s.seat('soldier'))).toMatchObject({ kind: 'number', value: 0 });
		expect(answers.get(s.seat('pacifist'))).toMatchObject({ kind: 'number', value: 0 });
		expect(answers.get(s.seat('sage'))).toMatchObject({ value: 0, mustBeFalse: true });
	});

	it('Example 3: two evil visitors, the Imp has False Info', () => {
		const s = scenario(['mastermind', 'imp', 'minstrel', 'chef', 'empath'])
			.rule('duchess')
			.reminder('mastermind', 'duchess', 'Visitor')
			.reminder('minstrel', 'duchess', 'Visitor')
			.reminder('imp', 'duchess', 'False Info');
		const answers = duchessAnswers(s);
		expect(answers.get(s.seat('mastermind'))).toMatchObject({ value: 2 });
		expect(answers.get(s.seat('minstrel'))).toMatchObject({ value: 2 });
		expect(answers.get(s.seat('imp'))).toMatchObject({ value: 2, mustBeFalse: true });
	});
});
