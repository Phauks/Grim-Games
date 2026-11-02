/**
 * Assassin: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Assassin
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Assassin.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { becomesOffer } from '#lib/core/rules/becomes.ts';
import { survivesFirstDeath } from '#lib/core/rules/first-death.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Assassin', () => {
	const character = committedCharacter('assassin');

	describe('data (roles.json)', () => {
		it('is a Minion from edition bmr', () => {
			expect(character.name).toBe('Assassin');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('assassin')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Assassin#Examples)', () => {
		it('Example 1: Assassin waits, later kills Fool', () => {
			// Wiki: "For the first three nights the Assassin wakes, but chooses not to act. During the
			// fourth night, they choose to kill the Fool. Even though the Fool still has their ability,
			// the Fool dies and stays dead."
			// Waiting spends nothing; the Fool's unused ability does not stop the Assassin's kill.
			const s = scenario(['assassin', 'fool', 'chef', 'empath', 'imp'])
				.newDay()
				.newDay()
				.newDay()
				.reminder('fool', 'assassin', 'Dead');
			expect(abilityState(s.game, s.seat('assassin'), s.characters).works).toBe(true);
			expect(survivesFirstDeath(s.game, s.seat('fool'), 'demon', s.characters)).toBeDefined();
			expect(survivesFirstDeath(s.game, s.seat('fool'), 'assassin', s.characters)).toBeUndefined();
			const fool = nightStepAlerts(s.game, 'assassin', s.characters).filter(
				(a) => a.seatId === s.seat('fool')
			);
			expect(fool.map((a) => a.kind)).not.toContain('survives-first-death');
		});
		it('Example 2: Protected neighbour dies despite Tea Lady', () => {
			// Wiki: "The Tea Lady neighbours two good players. The Assassin chooses to kill one of the
			// Tea Lady’s neighbours, who dies even though they were protected by the Tea Lady."
			const s = scenario(['chef', 'tealady', 'empath', 'assassin', 'imp'])
				.reminder('chef', 'tealady', 'Cannot Die')
				.reminder('empath', 'tealady', 'Cannot Die');
			const chef = nightStepAlerts(s.game, 'assassin', s.characters).filter(
				(a) => a.seatId === s.seat('chef')
			);
			expect(chef.map((a) => a.kind)).not.toContain('protected');
			// The Demon's kill on the same player would be stopped.
			const byDemon = nightStepAlerts(s.game, 'imp', s.characters).filter(
				(a) => a.seatId === s.seat('chef')
			);
			expect(byDemon.map((a) => a.kind)).toContain('protected');
		});
		it('Example 3: Drunk Assassin fails to kill Moonchild', () => {
			// Wiki: "The Minstrel is in play. The Mastermind dies by execution. That night, the Assassin
			// chooses to kill the Moonchild, but they do not die, because the Assassin is drunk due to
			// the Minstrel."
			const s = scenario(['minstrel', 'moonchild', 'chef', 'mastermind', 'assassin', 'imp'])
				.newDay()
				.execute('mastermind')
				.reminder('minstrel', 'minstrel', 'Everyone Is Drunk')
				.reminder('moonchild', 'assassin', 'Dead');
			expect(abilityState(s.game, s.seat('assassin'), s.characters).impairments).toMatchObject([
				{ reason: 'drunk', source: { characterId: 'minstrel' } }
			]);
			const [survivor] = preventedDeaths(s.game, s.characters);
			expect(survivor).toMatchObject({ killer: 'assassin', seatId: s.seat('moonchild') });
			expect(survivor.because.map((b) => b.kind)).toEqual(['killer-impaired']);
		});
		it("Example 4: Drunk Assassin's kill fails; Goon turns evil", () => {
			// Wiki: "The Assassin, who was drunk due to the Courtier, chooses to kill the Goon. The
			// Assassin has no ability, so the Goon remains alive but turns evil."
			// The Goon's Drunk goes on the Assassin, who chose the Goon first tonight.
			const s = scenario(['courtier', 'goon', 'chef', 'assassin', 'imp'])
				.reminder('assassin', 'courtier', 'Drunk 3')
				.reminder('goon', 'assassin', 'Dead')
				.reminder('assassin', 'goon', 'Drunk');
			const [survivor] = preventedDeaths(s.game, s.characters);
			expect(survivor).toMatchObject({ killer: 'assassin', seatId: s.seat('goon') });
			expect(survivor.because.map((b) => b.kind)).toEqual(['killer-impaired']);
			expect(
				becomesOffer(
					s.game,
					s.seat('assassin'),
					{ characterId: 'goon', label: 'Drunk' },
					s.characters
				)
			).toEqual({
				into: 'alignment',
				seatId: s.seat('goon'),
				characterId: 'goon',
				alignment: 'evil'
			});
		});
	});
});
