/**
 * Atheist: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Atheist
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Atheist.
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
import { endCharacters } from '#lib/core/rules/end-reason.ts';
import {
	anyInfoSource,
	infoPicker,
	isAllowed,
	reliability,
	validInformation
} from '#lib/core/rules/night-info.ts';
import { analyseSetup } from '#lib/core/rules/setup.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Atheist', () => {
	const character = committedCharacter('atheist');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Atheist');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('atheist')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'selection', name: 'good-duplicate' },
				{ type: 'selection', name: 'evil-duplicate' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Atheist#Examples)', () => {
		it('Example 1: False info and unexplained deaths in one night', () => {
			// Wiki: "The Investigator learns that either the Grandmother or the Seamstress is the Boomdandy.
			// The Sweetheart nominates, and dies, even though there is no Witch in play. The Slayer uses their
			// ability on the Gossip, who dies."
			// With the Atheist in play the Storyteller may break the rules: any information may be
			// given, and players die whenever the Storyteller says.
			const s = scenario([
				'atheist',
				'investigator',
				'grandmother',
				'seamstress',
				'sweetheart',
				'slayer',
				'gossip'
			]);
			const picker = infoPicker(s.game, s.seat('investigator'), 'investigator', s.characters)!;
			const pair = [s.seat('grandmother'), s.seat('seamstress')];
			expect(picker.anyBy).toBe('atheist');
			expect(isAllowed(picker, { seats: pair, characterId: 'boomdandy' })).toBe(true);
			const after = s.dies('sweetheart').dies('gossip');
			for (const seat of ['sweetheart', 'gossip'] as const) {
				expect(after.game.seats[after.seat(seat)].dead).toBe(true);
			}
		});

		it.fails('Example 2: Extra Outsider appears; executing Storyteller wins', () => {
			// Wiki: "There are three Outsiders in play, when there should be two. The players execute the
			// Storyteller. Good wins."
			// Nine players with the Atheist: no Minion or Demon, and any number of Outsiders.
			const cast = [
				'atheist',
				'investigator',
				'grandmother',
				'seamstress',
				'slayer',
				'gossip',
				'sweetheart',
				'butler',
				'saint'
			];
			const s = scenario(cast);
			const analysis = analyseSetup({
				players: 9,
				inPlay: cast.map((id) => s.characters.get(id)!)
			});
			expect(analysis.expected.outsider).toContain(3);
			expect(analysis.warnings.map((w) => w.code)).not.toContain('count-mismatch');
			expect(endCharacters(s.game, s.characters)).toContain('atheist');
			engineGap(
				'unplanned',
				'executing the Storyteller while the Atheist is in play ends the game, and good wins'
			);
		});
	});

	describe('the Storyteller may break the rules (its `breaksRules` rule)', () => {
		const cast = ['atheist', 'investigator', 'grandmother', 'seamstress', 'chef', 'empath'];

		it('lists any other information as valid, marked as allowed by the Atheist', () => {
			const s = scenario(cast);
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.anyAllowed).toBe(true);
			const valid = validInformation(s.game, picker);
			expect(valid[0]).toMatchObject({ reason: 'true', number: 0 });
			expect(valid.slice(1).every((v) => v.reason === 'any')).toBe(true);
			expect(anyInfoSource(s.game, s.characters)).toEqual({
				seatId: s.seat('atheist'),
				characterId: 'atheist'
			});
		});

		it('still counts once the Atheist is dead: their character is in play', () => {
			const s = scenario(cast).dies('atheist');
			expect(reliability(s.game, s.seat('chef'), 'chef', s.characters).anyBy).toBe('atheist');
		});

		it('allows nothing extra without the Atheist', () => {
			const s = scenario(cast.slice(1).concat('monk'));
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.anyAllowed).toBe(false);
			expect(picker.anyBy).toBeUndefined();
		});
	});
});
