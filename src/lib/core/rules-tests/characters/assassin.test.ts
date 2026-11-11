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
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { becomesOffer } from '#lib/core/rules/abilities/becomes.ts';
import { survivesFirstDeath } from '#lib/core/rules/abilities/first-death.ts';
import { nightStepAlerts } from '#lib/core/rules/night/night-alerts.ts';
import { preventedDeaths } from '#lib/core/rules/day/prevented-deaths.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import {
	nightTextPlain,
	nightTextSegments,
	placeholdersFor
} from '#lib/core/rules/night/night-text.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';
import { wokeTonight } from '#lib/core/rules/night/woke-tonight.ts';

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

	describe('How to Run (https://wiki.bloodontheclocktower.com/Assassin#How_to_Run)', () => {
		const cast = ['assassin', 'chef', 'innkeeper', 'sailor', 'poisoner', 'imp'];
		const otherNightText = () => {
			const placeholders = placeholdersFor(character, 'other');
			return nightTextPlain(
				nightTextSegments(character.otherNightReminder!, character, {
					...(placeholders ? { placeholders } : {})
				})
			);
		};

		it('may choose no one, or any player, themself included', () => {
			// Wiki: "Each night except the first, wake the Assassin. They either shake their head no or
			// point at any player."
			const s = scenario(cast).newDay().dies('chef', 'demon');
			const dead = { characterId: 'assassin', label: 'Dead' };
			for (const seat of ['assassin', 'chef', 'imp'] as const)
				expect(reminderTargetMisses(s.game, dead, s.seat(seat), s.characters), seat).toEqual([]);
			expect(otherNightText()).toContain('might choose a player');
		});

		it('kills through the Innkeeper, but not while poisoned', () => {
			// Wiki: "If the Assassin chose a player, that player dies— mark them with the DEAD reminder.
			// This cannot be prevented in any way (except if the Assassin doesn’t have their ability,
			// such as if they’re drunk or poisoned)."
			const s = scenario(cast).newDay().reminder('chef', 'innkeeper', 'Safe');
			const protectedSeats = (at: typeof s) =>
				nightStepAlerts(at.game, 'assassin', at.characters)
					.filter((a) => a.kind === 'protected')
					.map((a) => a.seatId);
			expect(protectedSeats(s)).toEqual([]);
			const byDemon = nightStepAlerts(s.game, 'imp', s.characters).filter(
				(a) => a.kind === 'protected'
			);
			expect(byDemon.map((a) => a.seatId)).toContain(s.seat('chef'));
			expect(otherNightText()).toContain('[+Dead]');
			const poisoned = s.poisoned('assassin').reminder('sailor', 'assassin', 'Dead');
			const [survivor] = preventedDeaths(poisoned.game, poisoned.characters);
			expect(survivor).toMatchObject({ killer: 'assassin', seatId: poisoned.seat('sailor') });
			expect(survivor.because.map((b) => b.kind)).toContain('killer-impaired');
		});

		it('marks the Assassin No Ability once they have chosen', () => {
			// Wiki: "The Assassin loses their ability—mark them with the NO ABILITY reminder"
			const s = scenario(cast).newDay();
			const spent = { characterId: 'assassin', label: 'No Ability' };
			expect(reminderTargetMisses(s.game, spent, s.seat('assassin'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, spent, s.seat('chef'), s.characters)).not.toEqual([]);
			expect(otherNightText()).toContain('[+No Ability]');
		});

		it('stops waking the Assassin once they are marked No Ability', () => {
			// Wiki: "and remove their night token from the night sheet. (The Assassin won’t wake
			// again.)"
			const s = scenario(cast).newDay();
			expect(wokeTonight(s.game, s.seat('assassin'), s.characters, 'other')).toBe(true);
			const spent = s.reminder('assassin', 'assassin', 'No Ability');
			expect(wokeTonight(spent.game, spent.seat('assassin'), spent.characters, 'other')).toBe(
				false
			);
		});
	});
});
