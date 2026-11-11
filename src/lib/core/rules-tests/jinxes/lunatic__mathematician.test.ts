/**
 * Jinx Lunatic + Mathematician: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Lunatic
 * Wiki: https://wiki.bloodontheclocktower.com/Mathematician
 * (the wiki has no jinx page; each character's page lists the jinx under "Related Jinxes")
 */
import { describe, expect, it } from 'vitest';
import { findJinx, jinxesAmong } from '#lib/core/data/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { ownJinxRules } from '#lib/core/rules/jinxes/jinxes.ts';
import { nightAnswer } from '#lib/core/rules/night/info/answers.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { scriptOf } from './summoner.test-support.ts';

describe('Lunatic + Mathematician jinx', () => {
	const data = committedGameData();
	const jinx = findJinx(data.jinxes, 'lunatic', 'mathematician');

	it('is in jinxes.json between two official characters', () => {
		expect(data.byId.get('lunatic')?.name).toBe('Lunatic');
		expect(data.byId.get('mathematician')?.name).toBe('Mathematician');
		expect(jinx).toBeDefined();
		expect(jinx?.reason).not.toBe('');
	});

	it('applies only when both characters are on the script', () => {
		expect(jinxesAmong(data.jinxes, ['lunatic', 'mathematician'])).toContain(jinx);
		expect(jinxesAmong(data.jinxes, ['lunatic'])).not.toContain(jinx);
		expect(jinxesAmong(data.jinxes, ['mathematician'])).not.toContain(jinx);
	});

	describe('the Mathematician learns if the Lunatic attacked another player than the Demon', () => {
		const cast = ['mathematician', 'lunatic', 'imp', 'chef', 'empath', 'monk'];
		const base = scenario(cast, { script: scriptOf(cast) }).newDay();
		// The Lunatic chooses the Chef tonight; the Imp kills `victim`.
		const night = (s: Scenario, victim: 'chef' | 'empath') =>
			s.reminder('chef', 'lunatic', 'Chosen').dies(victim, 'imp');
		const count = (s: Scenario, died: readonly string[]) =>
			nightAnswer(s.game, s.seat('mathematician'), 'mathematician', s.characters, {
				died: died.map((c) => s.seat(c))
			});

		it("is data in the Mathematician's rules", () => {
			// Wiki: "The Mathematician learns if the Lunatic attacks a different player than the real Demon attacked."
			expect(ownJinxRules(base.game, 'mathematician', 'lunatic', base.characters)).toEqual({
				abnormalCounts: { counts: 'unlike-demon' }
			});
		});

		it('counts the Lunatic when the Demon killed someone else', () => {
			// Wiki: "The Mathematician learns if the Lunatic attacks a different player than the real Demon attacked."
			const s = night(base, 'empath');
			expect(count(s, ['empath'])).toMatchObject({
				kind: 'number',
				value: 1,
				because: [s.seat('lunatic')],
				abnormal: [{ seatId: s.seat('lunatic'), characterId: 'lunatic' }]
			});
		});

		it('counts nothing when the Demon killed the player the Lunatic chose', () => {
			// Wiki: "attacks a different player than the real Demon attacked"
			const s = night(base, 'chef');
			expect(count(s, ['chef'])).toMatchObject({ kind: 'number', value: 0, abnormal: [] });
		});

		it('leaves it to the Storyteller when no Demon kill is recorded', () => {
			// Wiki: "than the real Demon attacked"
			// The Demon may have attacked a protected player: the Abnormal reminders decide.
			const s = base.reminder('chef', 'lunatic', 'Chosen');
			expect(count(s, [])).toMatchObject({ kind: 'number', value: 0 });
			const marked = s.reminder('lunatic', 'mathematician', 'Abnormal');
			expect(count(marked, [])).toMatchObject({ value: 1, because: [s.seat('lunatic')] });
		});

		it('counts nothing off the jinxed script', () => {
			// Wiki: "The Mathematician learns if the Lunatic"
			const plain = night(
				scenario(cast, {
					script: scriptOf(cast.filter((id) => id !== 'lunatic'))
				}).newDay(),
				'empath'
			);
			expect(count(plain, ['empath'])).toMatchObject({ kind: 'number', value: 0 });
		});
	});
});
