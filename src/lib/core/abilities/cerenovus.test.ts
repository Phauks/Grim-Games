/**
 * Cerenovus: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Cerenovus
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Cerenovus.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { madnessOffer } from '#lib/core/rules/madness.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Cerenovus', () => {
	const character = committedCharacter('cerenovus');

	describe('data (roles.json)', () => {
		it('is a Minion from edition snv', () => {
			expect(character.name).toBe('Cerenovus');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Mad']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('cerenovus')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Cerenovus#Examples)', () => {
		it('Example 1: Barber mad as Savant and survives', () => {
			// Wiki: "The Cerenovus makes the Barber mad about being the Savant. Tomorrow, the Barber
			// claims to be the Savant, talks to the Storyteller, and tells the group two facts that they
			// made up. When asked whether they are mad, the Barber says "no" emphatically, so avoids
			// being executed."
			// The app offers the execution on the Mad reminder; the Storyteller declines it.
			const s = scenario(['cerenovus', 'barber', 'savant', 'chef', 'nodashii']).reminder(
				'barber',
				'cerenovus',
				'Mad'
			);
			expect(madnessOffer(s.game, 'cerenovus', s.seat('barber'), s.characters)).toEqual({
				characterId: 'cerenovus',
				seatId: s.seat('barber'),
				breaking: 'execution',
				dies: []
			});
			expect(s.game.seats[s.seat('barber')].dead).toBe(false);
			expect(s.game.today.entries.filter((e) => e.kind === 'execution')).toEqual([]);
		});

		it('Example 2: Silent dead Artist, mad as Sage, is executed', () => {
			// Wiki: "The dead Artist is made mad about being the Sage. The next day, they say nothing
			// about being the Sage. The Artist is executed."
			const s = scenario(['cerenovus', 'artist', 'sage', 'chef', 'nodashii'])
				.dies('artist', 'nodashii')
				.reminder('artist', 'cerenovus', 'Mad');
			const offer = madnessOffer(s.game, 'cerenovus', s.seat('artist'), s.characters);
			expect(offer).toMatchObject({ breaking: 'execution', seatId: s.seat('artist') });
			const after = s.do((at) => ({
				type: 'Execute',
				seatId: at.seat('artist'),
				cause: 'cerenovus'
			}));
			expect(after.game.today.entries).toMatchObject([
				{ kind: 'execution', seatId: s.seat('artist'), died: false }
			]);
		});

		it("Example 3: Flowergirl's private hints get them executed anyway", () => {
			// Wiki: "The Cerenovus makes the Flowergirl mad about being the Clockmaker. The Flowergirl
			// says to the group that they are the Clockmaker and learned a "2,” but hints privately to
			// other players that they are mad. The Storyteller overhears this and executes the
			// Flowergirl."
			const s = scenario(['cerenovus', 'flowergirl', 'clockmaker', 'chef', 'nodashii']).reminder(
				'flowergirl',
				'cerenovus',
				'Mad'
			);
			const offer = madnessOffer(s.game, 'cerenovus', s.seat('flowergirl'), s.characters)!;
			expect(offer.breaking).toBe('execution');
			const after = s.do((at) => ({
				type: 'Execute',
				seatId: at.seat('flowergirl'),
				cause: offer.characterId
			}));
			expect(after.game.seats[after.seat('flowergirl')]).toMatchObject({
				dead: true,
				deathCause: 'cerenovus'
			});
		});
	});
});
