/**
 * How many players a killing step may choose tonight, and who its delayed kill takes
 * (`nightKill`). Each case paraphrases the wiki page it encodes:
 * - https://wiki.bloodontheclocktower.com/Po: one attack, or three after choosing no one;
 * - https://wiki.bloodontheclocktower.com/Shabaloth: two attacks a night;
 * - https://wiki.bloodontheclocktower.com/Pukka: last night's poisoned player dies tonight;
 * - https://wiki.bloodontheclocktower.com/Exorcist: a chosen Demon does not wake to act.
 */
import { describe, expect, it } from 'vitest';
import { Issues } from '#lib/core/data/validate.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { nightKill } from './night-kill.ts';

describe('nightKill', () => {
	it('is undefined for a character that does not kill', () => {
		const s = scenario(['chef', 'imp']);
		expect(nightKill(s.game, s.seat('chef'), 'chef', s.characters)).toBeUndefined();
	});

	it('gives one attack, a counted number, or the charged number', () => {
		const s = scenario(['po', 'shabaloth', 'chef', 'empath']);
		expect(nightKill(s.game, s.seat('po'), 'po', s.characters)).toEqual({ max: 1, delayed: [] });
		expect(nightKill(s.game, s.seat('shabaloth'), 'shabaloth', s.characters)?.max).toBe(2);
		const charged = s.reminder('po', 'po', '3 Attacks');
		expect(nightKill(charged.game, charged.seat('po'), 'po', charged.characters)?.max).toBe(3);
	});

	it('chooses no one while stopped waking, and a delayed kill still lands', () => {
		const s = scenario(['pukka', 'exorcist', 'chef', 'empath'])
			.reminder('chef', 'pukka', 'Poisoned')
			.reminder('pukka', 'exorcist', 'Chosen');
		expect(nightKill(s.game, s.seat('pukka'), 'pukka', s.characters)).toEqual({
			max: 0,
			delayed: [s.seat('chef')]
		});
	});

	it('ignores a stopping token from a poisoned source', () => {
		const s = scenario(['po', 'exorcist', 'chef', 'empath', 'poisoner'])
			.reminder('po', 'exorcist', 'Chosen')
			.poisoned('exorcist');
		expect(nightKill(s.game, s.seat('po'), 'po', s.characters)?.max).toBe(1);
	});
});

describe('kills part', () => {
	const parse = (raw: unknown) => {
		const issues = new Issues();
		const rules = parseCharacterRules(raw, 'rules', issues, ['3 Attacks', 'Poisoned']);
		return { kills: rules?.kills, issues: issues.list };
	};

	it('reads count, charged and delayed', () => {
		expect(
			parse({
				kills: {
					by: 'demon',
					count: 2,
					charged: { token: '3 Attacks', count: 3 },
					delayed: 'Poisoned'
				}
			})
		).toEqual({
			kills: {
				by: 'demon',
				count: 2,
				charged: { token: '3 Attacks', count: 3 },
				delayed: 'Poisoned'
			},
			issues: []
		});
	});

	it('refuses a bad count or another character’s token', () => {
		expect(parse({ kills: { by: 'demon', count: 0 } }).issues).toEqual([
			'rules.kills.count: expected a whole number from 1, got 0'
		]);
		expect(parse({ kills: { by: 'demon', delayed: 'Drunk' } }).issues).toEqual([
			'rules.kills.delayed: not one of this character’s reminders'
		]);
		expect(parse({ kills: { by: 'demon', charged: { token: '3 Attacks' } } }).issues).toEqual([
			'rules.kills.charged.count: missing'
		]);
	});
});
