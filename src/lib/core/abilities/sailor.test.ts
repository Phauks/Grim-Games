/**
 * Sailor: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Sailor
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Sailor.
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
import { protection } from '#lib/core/rules/ability.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Sailor', () => {
	const character = committedCharacter('sailor');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Sailor');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Drunk']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('sailor')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Sailor#Examples)', () => {
		it('Example 1: Sailor picks Exorcist, survives attack and execution', () => {
			// Wiki: "The Sailor chooses the Exorcist, and the Storyteller decides that the Exorcist is drunk.
			// That night, the Sailor is attacked by the Shabaloth. The Sailor remains alive. The next day,
			// the Sailor is executed but remains alive."
			const s = scenario(['sailor', 'exorcist', 'shabaloth', 'chef', 'poisoner'])
				.reminder('exorcist', 'sailor', 'Drunk')
				.reminder('sailor', 'shabaloth', 'Dead');
			expect(preventedDeaths(s.game, s.characters)).toMatchObject([
				{
					seatId: s.seat('sailor'),
					because: [
						{ kind: 'protected', source: { characterId: 'sailor', seatId: s.seat('sailor') } }
					]
				}
			]);
			const executed = s.newDay().execute('sailor');
			expect(executed.game.seats[s.seat('sailor')].dead).toBe(false);
		});

		it("Example 2: Self-drunk Sailor dies to Gossip's kill", () => {
			// Wiki: "During the day, the Gossip made a public statement they thought was false, but was
			// actually true. That night, the Gossip ability kills a player. The Sailor has made themself
			// drunk, and the Storyteller decides that the Sailor dies."
			const s = scenario(['sailor', 'gossip', 'imp', 'chef', 'poisoner']).reminder(
				'sailor',
				'sailor',
				'Drunk'
			);
			expect(protection(s.game, s.seat('sailor'), s.characters, 'other')).toBeUndefined();
			expect(validDeathCauses(s.game, s.seat('sailor'), s.characters)).toContainEqual(
				expect.objectContaining({ cause: 'gossip', flags: [] })
			);
		});

		it('Example 3: Drunk Sailor dies after requesting execution', () => {
			// Wiki: "The Sailor chooses the Mastermind, but the Storyteller decides that the Sailor is drunk.
			// The next day, the Sailor asks to be executed to “prove they are the Sailor,” but dies because
			// they're drunk."
			const s = scenario(['sailor', 'mastermind', 'imp', 'chef', 'poisoner']).reminder(
				'sailor',
				'sailor',
				'Drunk'
			);
			expect(protection(s.game, s.seat('sailor'), s.characters, 'execution')).toBeUndefined();
			expect(s.newDay().execute('sailor').game.seats[s.seat('sailor')].dead).toBe(true);
		});
	});
});
