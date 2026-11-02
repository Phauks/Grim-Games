/**
 * Scarlet Woman: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Scarlet_Woman
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Scarlet Woman.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { gameEnds, suggestedWinner } from '#lib/core/rules/game-end.ts';
import { infoPicker, isTruthful } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Scarlet Woman', () => {
	const character = committedCharacter('scarletwoman');

	describe('data (roles.json)', () => {
		it('is a Minion from edition tb', () => {
			expect(character.name).toBe('Scarlet Woman');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Is The Demon']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('scarletwoman')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Scarlet_Woman#Examples)', () => {
		it('Example 1: Executing Imp with Travellers present ends game', () => {
			// Wiki: "There are seven players alive: the Imp, the Scarlet Woman, two Townsfolk, and three
			// Travellers. The Imp is executed, so the game ends and good wins because Travellers do not
			// add to the player count for the Scarlet Woman's ability."
			// Seven alive, three of them Travellers: Travellers don't count toward the five, so the
			// Scarlet Woman doesn't become the Imp and good wins.
			const s = scenario(['imp', 'scarletwoman', 'chef', 'monk', 'beggar', 'gunslinger', 'thief'])
				.do(
					(at) => ({ type: 'SetAlignment', seatId: at.seat('beggar'), alignment: 'good' }),
					(at) => ({ type: 'SetAlignment', seatId: at.seat('gunslinger'), alignment: 'good' }),
					(at) => ({ type: 'SetAlignment', seatId: at.seat('thief'), alignment: 'good' })
				)
				.execute('imp');
			const ends = gameEnds(s.game, s.characters);
			expect(ends).toMatchObject([{ rule: 'demon-dead', winner: 'good', holds: [] }]);
			expect(suggestedWinner(ends)).toBe('good');
		});
		it('Example 2: Five players alive: Scarlet Woman becomes Imp', () => {
			// Wiki: "There are five players alive: the Imp, the Scarlet Woman, the Baron, and two
			// Townsfolk. The Imp is executed. The Scarlet Woman becomes the Imp, and the game continues."
			const s = scenario(['imp', 'scarletwoman', 'baron', 'chef', 'monk']).execute('imp');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{
					rule: 'demon-dead',
					holds: [
						{ rule: 'becomes-demon', characterId: 'scarletwoman', seats: [s.seat('scarletwoman')] }
					]
				}
			]);
		});
		it("Example 3: Fortune Teller's answer flips after Imp dies", () => {
			// Wiki: "Brianna is the Scarlet Woman. The Fortune Teller chooses Brianna and Alex, and learns
			// a "no.” Later, the Imp dies, so Brianna becomes the Imp. The Fortune Teller chooses Brianna
			// and Alex again, and learns a "yes.""
			const s = scenario(['fortuneteller', 'scarletwoman', 'chef', 'imp', 'monk', 'empath']);
			const chose = [s.seat('scarletwoman'), s.seat('chef')];
			const before = infoPicker(s.game, s.seat('fortuneteller'), 'fortuneteller', s.characters)!;
			expect(isTruthful(before, { seats: chose, yes: false })).toBe(true);
			const after = s.execute('imp').becomes('scarletwoman', 'imp');
			const picker = infoPicker(
				after.game,
				after.seat('fortuneteller'),
				'fortuneteller',
				after.characters
			)!;
			expect(isTruthful(picker, { seats: chose, yes: true })).toBe(true);
		});
	});
});
