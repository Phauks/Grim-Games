/**
 * Fool: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Fool
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Fool.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { protection } from '#lib/core/rules/ability.ts';
import { survivesFirstDeath } from '#lib/core/rules/first-death.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

const CAST = ['fool', 'chef', 'poisoner', 'assassin', 'imp'];

describe('Fool', () => {
	const character = committedCharacter('fool');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Fool');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
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
			expect(nightSheetPresence('fool')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Fool#Examples)', () => {
		it('Example 1: survives the first execution, then dies to the second', () => {
			// Wiki: "On the first day, the Fool is executed but remains alive. On the fourth day, the
			// Fool is executed again. This time, they die."
			const s = scenario(CAST);
			expect(survivesFirstDeath(s.game, s.seat('fool'), 'execution', s.characters)).toMatchObject({
				spentToken: 'No Ability'
			});
			const after = s.reminder('fool', 'fool', 'No Ability');
			expect(
				survivesFirstDeath(after.game, after.seat('fool'), 'execution', after.characters)
			).toBeUndefined();
		});

		it('Example 2: survives a night kill, so a later execution kills them', () => {
			// Wiki: "The Demon attacks the Fool, who remains alive. Nobody dies that night. The next
			// day, the Fool is executed by the Judge, and dies."
			const s = scenario(CAST);
			expect(survivesFirstDeath(s.game, s.seat('fool'), 'demon', s.characters)).toMatchObject({
				spentToken: 'No Ability'
			});
			const after = s.reminder('fool', 'fool', 'No Ability');
			expect(
				survivesFirstDeath(after.game, after.seat('fool'), 'execution', after.characters)
			).toBeUndefined();
		});
		it.fails('Example 3: Protected twice; ability saves once', () => {
			// Wiki: "The Demon attacks the Fool, who is protected by the Tea Lady. The Fool remains
			// alive and keeps their ability. Later, after the Tea Lady has died, the Demon attacks the
			// Fool, who is now protected by the Innkeeper. The Fool remains alive and keeps their
			// ability. Later, after the Innkeeper has died, the Demon attacks the Fool, who remains
			// alive again but uses their ability, so next time they will die."
			// Waits on the engine (bug): a protected Fool's survival still lists the Fool's own ability
			// beside the protection, as if it were spent.
			const s = scenario(['chef', 'tealady', 'fool', 'innkeeper', 'empath', 'imp'])
				.reminder('chef', 'tealady', 'Cannot Die')
				.reminder('fool', 'tealady', 'Cannot Die')
				.reminder('fool', 'imp', 'Dead');
			expect(protection(s.game, s.seat('fool'), s.characters, 'demon')).toMatchObject({
				characterId: 'tealady'
			});

			const inn = s.dies('tealady', 'demon').newDay().reminder('fool', 'innkeeper', 'Safe');
			expect(protection(inn.game, inn.seat('fool'), inn.characters, 'demon')).toMatchObject({
				characterId: 'innkeeper'
			});

			const bare = inn.dies('innkeeper', 'demon').newDay();
			expect(protection(bare.game, bare.seat('fool'), bare.characters, 'demon')).toBeUndefined();
			expect(
				survivesFirstDeath(bare.game, bare.seat('fool'), 'demon', bare.characters)
			).toMatchObject({ spentToken: 'No Ability' });

			// Protected, the Fool keeps their ability: protection is the only reason they live.
			const [survivor] = preventedDeaths(s.game, s.characters);
			expect(survivor.because.map((b) => b.kind)).toEqual(['protected']);
		});
	});

	// https://wiki.bloodontheclocktower.com/Assassin: the Assassin's kill works even if the
	// player could not die (Trevor, 2026-10-22: "the Assassin overrides everything"). A
	// poisoned Fool has no ability (https://wiki.bloodontheclocktower.com/Poisoner).
	it('dies to the Assassin, and when poisoned; only the Fool survives this way', () => {
		const { session, seats } = castGame(CAST);
		expect(survivesFirstDeath(session.game, seats[0], 'assassin', characters)).toBeUndefined();
		expect(survivesFirstDeath(session.game, seats[1], 'demon', characters)).toBeUndefined();
		const poisoned = castGame(CAST, (s) => ({
			type: 'AddReminder',
			seatId: s[0],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		}));
		expect(
			survivesFirstDeath(poisoned.session.game, poisoned.seats[0], 'demon', characters)
		).toBeUndefined();
	});
});
