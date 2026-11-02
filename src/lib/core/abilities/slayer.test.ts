/**
 * Slayer: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Slayer
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Slayer.
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
import { dayUseDeath, dayUseOf } from '#lib/core/rules/day-claims.ts';
import { gameEnds, suggestedWinner } from '#lib/core/rules/game-end.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Slayer', () => {
	const character = committedCharacter('slayer');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Slayer');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('slayer')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Slayer#Examples)', () => {
		it('Example 1: Slayer targets Imp and wins the game', () => {
			// Wiki: "The Slayer chooses the Imp. The Imp dies, and good wins!"
			const s = scenario(['slayer', 'imp', 'poisoner', 'chef', 'monk']);
			expect(dayUseDeath(s.game, 'slayer', s.seat('imp'), s.characters)).toBe('dies');
			const after = s.dies('imp', 'slayer');
			expect(suggestedWinner(gameEnds(after.game, after.characters))).toBe('good');
		});
		it('Example 2: Slayer hits Recluse, who registers as Demon', () => {
			// Wiki: "The Slayer chooses the Recluse. The Storyteller decides that the Recluse registers as
			// the Imp, so the Recluse dies, but the game continues."
			// The Recluse may die to the shot; the game goes on, as the real Imp lives.
			const s = scenario(['slayer', 'recluse', 'imp', 'chef', 'poisoner']);
			expect(dayUseDeath(s.game, 'slayer', s.seat('recluse'), s.characters)).toBe('maybe');
			const after = s.dies('recluse', 'slayer');
			expect(gameEnds(after.game, after.characters)).toEqual([]);
		});
		it('Example 3: Imp fakes Slayer claim on Scarlet Woman', () => {
			// Wiki: "The Imp is bluffing as the Slayer. They declare that they use their Slayer ability on
			// the Scarlet Woman. Nothing happens."
			// The Imp has no day ability, and the Scarlet Woman isn't the Demon: nothing happens.
			const s = scenario(['imp', 'scarletwoman', 'chef', 'monk', 'empath']);
			expect(dayUseOf('imp', s.characters)).toBeUndefined();
			expect(dayUseDeath(s.game, 'slayer', s.seat('scarletwoman'), s.characters)).toBe('no');
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Slayer#How_to_Run)', () => {
		it('kills only an alive Demon', () => {
			// How to Run: the chosen player dies only if they are the Demon and alive; otherwise
			// nothing happens.
			const s = scenario(['slayer', 'imp', 'poisoner', 'chef', 'monk']);
			expect(dayUseDeath(s.game, 'slayer', s.seat('imp'), s.characters)).toBe('dies');
			expect(dayUseDeath(s.game, 'slayer', s.seat('chef'), s.characters)).toBe('no');
			const dead = s.dies('imp', 'execution');
			expect(dayUseDeath(dead.game, 'slayer', dead.seat('imp'), dead.characters)).toBe('no');
		});

		it('offers the Slayer as the cause of death only for a player who may be the Demon', () => {
			// How to Run: the Demon the Slayer shot dies, and gets a shroud.
			const s = scenario(['slayer', 'imp', 'poisoner', 'chef', 'monk']);
			const causes = (seat: 'imp' | 'chef') =>
				validDeathCauses(s.game, s.seat(seat), s.characters).map((c) => c.cause);
			expect(causes('imp')).toContain('slayer');
			expect(causes('chef')).not.toContain('slayer');
		});

		it('places No Ability on the Slayer whether or not the shot kills', () => {
			// How to Run: hit or miss, the Slayer's ability is spent and they get No Ability.
			const s = scenario(['slayer', 'imp', 'poisoner', 'chef', 'monk']).do((at) => ({
				type: 'UseAbility',
				seatId: at.seat('slayer'),
				characterId: 'slayer',
				on: at.seat('chef')
			}));
			expect(s.game.seats[s.seat('slayer')].reminders).toContainEqual(
				expect.objectContaining({ characterId: 'slayer', label: 'No Ability' })
			);
			expect(
				warned(s.session, s.ctx, {
					type: 'UseAbility',
					seatId: s.seat('slayer'),
					characterId: 'slayer',
					on: s.seat('imp')
				})
			).toContain('already-used');
		});

		it('logs a bluffed shot with a warning, and it kills nobody', () => {
			// How to Run: treat a player bluffing as the Slayer as if they were, then nothing happens.
			const s = scenario(['imp', 'scarletwoman', 'chef', 'monk', 'empath']);
			expect(
				warned(s.session, s.ctx, {
					type: 'UseAbility',
					seatId: s.seat('imp'),
					characterId: 'slayer',
					on: s.seat('chef')
				})
			).toContain('not-seat-character');
			const drunk = scenario(['slayer', 'imp', 'poisoner', 'chef', 'monk']).drunk('slayer');
			expect(dayUseDeath(drunk.game, 'slayer', drunk.seat('imp'), drunk.characters)).toBe('no');
		});
	});
});
